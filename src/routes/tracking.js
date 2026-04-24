/**
 * Notification Tracking Routes
 * 
 * Handles click tracking, delivery tracking, and error reporting
 * for push notifications. Supports both POST and GET methods.
 * 
 * FIXES: Removed duplicate /report-notification-error POST route
 * that existed at L2665 and L2984 in the original server.js.
 */

const express = require('express');
const router = express.Router();
const { db, sql } = require('../../db');
const { trackingRateLimiter } = require('../middleware/rateLimiter');
const { verifyNotificationToken } = require('../utils/tokenUtils');

// ─── Track Notification Click (POST) ─────────────────────────
router.post('/track-notification-click', trackingRateLimiter, async (req, res) => {
  console.log('/track-notification-click');

  try {
    const notificationId = req.body.notificationId || req.query.notificationId;
    const websiteId = req.body.websiteId || req.query.websiteId;
    const action = req.body.action || req.query.action || 'default';
    const endpoint = req.body.endpoint || req.query.endpoint;
    const timestamp = req.body.timestamp || req.query.timestamp || new Date().toISOString();
    const deviceType = req.body.deviceType || req.query.deviceType || req.get('User-Agent');
    const isDelayed = req.body.isDelayed || req.query.isDelayed;
    const token = req.body.token || req.query.token;

    if (!notificationId || !websiteId) {
      return res.status(400).json({ error: 'notificationId and websiteId are required' });
    }

    // Verify tracking token if provided
    if (token) {
      const decodedToken = verifyNotificationToken(token);
      if (!decodedToken ||
        decodedToken.notificationId !== notificationId ||
        decodedToken.websiteId !== websiteId ||
        decodedToken.action !== 'click') {
        return res.status(401).json({ error: 'Invalid tracking token' });
      }
    } else {
      console.warn(`Notification click tracking without token: ID=${notificationId}, Website=${websiteId}`);
    }

    console.log(`Tracking notification click: ID=${notificationId}, Website=${websiteId}, Action=${action}, ${isDelayed ? 'DELAYED' : 'REALTIME'}`);

    if (deviceType) {
      console.log(`Device info: ${deviceType.substring(0, 100)}...`);
    }

    // BUG-05 FIX: Use atomic SQL increment to prevent race conditions
    try {
      await sql`
        UPDATE notifications 
        SET "clickCount" = COALESCE("clickCount", 0) + 1
        WHERE id = ${notificationId}
      `;
    } catch (updateError) {
      console.error('Error updating notification click count:', updateError);
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (endpoint) {
      try {
        await db
          .from('subscriptions')
          .update({
            lastUsed: timestamp || new Date().toISOString(),
            deviceInfo: deviceType ? deviceType.substring(0, 255) : undefined,
          })
          .eq('endpoint', endpoint);
      } catch (subError) {
        console.log('Error updating subscription (non-critical):', subError);
      }
    }

    if (global.io) {
      global.io.emit('stats_update', { type: 'click', notificationId, websiteId });
    }

    res.status(200).json({ success: true, message: 'Notification click tracked successfully' });
  } catch (error) {
    console.error('Error in track-notification-click:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Track Notification Click (GET fallback) ─────────────────
router.get('/track-notification-click', trackingRateLimiter, async (req, res) => {
  console.log('/track-notification-click (GET method)');

  try {
    const notificationId = req.query.notificationId;
    const websiteId = req.query.websiteId;
    const endpoint = req.query.endpoint;
    const timestamp = req.query.timestamp || new Date().toISOString();
    const token = req.query.token;

    if (!notificationId || !websiteId) {
      return res.status(400).json({ error: 'notificationId and websiteId are required' });
    }

    if (token) {
      const decodedToken = verifyNotificationToken(token);
      if (!decodedToken ||
        decodedToken.notificationId !== notificationId ||
        decodedToken.websiteId !== websiteId ||
        decodedToken.action !== 'click') {
        return res.status(401).json({ error: 'Invalid tracking token' });
      }
    } else {
      console.warn(`Notification click tracking without token (GET): ID=${notificationId}, Website=${websiteId}`);
    }

    // C-1 FIX: Atomic SQL increment (matches POST handler)
    const result = await sql`
      UPDATE notifications 
      SET "clickCount" = COALESCE("clickCount", 0) + 1
      WHERE id = ${notificationId}
      RETURNING id
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (endpoint) {
      await db
        .from('subscriptions')
        .update({ lastUsed: timestamp })
        .eq('endpoint', endpoint);
    }

    if (global.io) {
      global.io.emit('stats_update', { type: 'click', notificationId, websiteId });
    }

    res.status(200).json({ success: true, message: 'Notification click tracked successfully' });
  } catch (error) {
    console.error('Error in track-notification-click (GET):', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Track Notification Delivery (POST) ──────────────────────
router.post('/track-notification-delivery', trackingRateLimiter, async (req, res) => {
  console.log('/track-notification-delivery');

  try {
    const notificationId = req.body.notificationId || req.query.notificationId;
    const websiteId = req.body.websiteId || req.query.websiteId;
    const endpoint = req.body.endpoint || req.query.endpoint;
    const timestamp = req.body.timestamp || req.query.timestamp || new Date().toISOString();
    const deviceType = req.body.deviceType || req.query.deviceType || req.get('User-Agent');
    const isDelayed = req.body.isDelayed || req.query.isDelayed;
    const token = req.body.token || req.query.token;

    if (!notificationId || !websiteId) {
      return res.status(400).json({ error: 'notificationId and websiteId are required' });
    }

    if (token) {
      const decodedToken = verifyNotificationToken(token);
      if (!decodedToken ||
        decodedToken.notificationId !== notificationId ||
        decodedToken.websiteId !== websiteId ||
        decodedToken.action !== 'delivery') {
        return res.status(401).json({ error: 'Invalid tracking token' });
      }
    } else {
      console.warn(`Notification delivery tracking without token: ID=${notificationId}, Website=${websiteId}`);
    }

    console.log(`Tracking notification delivery: ID=${notificationId}, Website=${websiteId}`);

    // BUG-05 FIX: Use atomic SQL increment to prevent race conditions
    try {
      const result = await sql`
        UPDATE notifications 
        SET "deliveredCount" = COALESCE("deliveredCount", 0) + 1
        WHERE id = ${notificationId}
        RETURNING id
      `;
      
      if (result.length === 0) {
        return res.status(404).json({ error: 'Notification not found' });
      }
    } catch (updateError) {
      console.error('Error updating notification delivery count:', updateError);
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (endpoint) {
      try {
        await db
          .from('subscriptions')
          .update({
            lastSuccessfulDelivery: timestamp,
            deviceInfo: deviceType ? deviceType.substring(0, 255) : undefined,
          })
          .eq('endpoint', endpoint);
      } catch (subError) {
        console.log('Error updating subscription (non-critical):', subError);
      }
    }

    if (global.io) {
      global.io.emit('stats_update', { type: 'delivery', notificationId, websiteId });
    }

    res.status(200).json({ success: true, message: 'Notification delivery tracked successfully' });
  } catch (error) {
    console.error('Error in track-notification-delivery:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Track Notification Delivery (GET) ───────────────────────
router.get('/track-notification-delivery', async (req, res) => {
  console.log('/track-notification-delivery (GET method)');

  try {
    const notificationId = req.query.notificationId;
    const websiteId = req.query.websiteId;
    const endpoint = req.query.endpoint;
    const timestamp = req.query.timestamp || new Date().toISOString();

    if (!notificationId || !websiteId) {
      return res.status(400).json({ error: 'notificationId and websiteId are required' });
    }

    // C-1 FIX: Atomic SQL increment (matches POST handler)
    const result = await sql`
      UPDATE notifications 
      SET "deliveredCount" = COALESCE("deliveredCount", 0) + 1
      WHERE id = ${notificationId}
      RETURNING id
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (endpoint) {
      await db
        .from('subscriptions')
        .update({ lastSuccessfulDelivery: timestamp })
        .eq('endpoint', endpoint);
    }

    if (global.io) {
      global.io.emit('stats_update', { type: 'delivery', notificationId, websiteId });
    }

    res.status(200).json({ success: true, message: 'Notification delivery tracked successfully' });
  } catch (error) {
    console.error('Error in track-notification-delivery (GET):', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Report Notification Error (POST) ────────────────────────
// FIXED: Was duplicated at L2665 and L2984 in original server.js
router.post('/report-notification-error', trackingRateLimiter, async (req, res) => {
  console.log('/report-notification-error');

  try {
    const notificationId = req.body.notificationId || req.query.notificationId;
    const websiteId = req.body.websiteId || req.query.websiteId;
    const endpoint = req.body.endpoint || req.query.endpoint;
    const error = req.body.error || req.query.error || 'Unknown error';
    const timestamp = req.body.timestamp || req.query.timestamp || new Date().toISOString();
    const token = req.body.token || req.query.token;

    if (!notificationId || !websiteId) {
      return res.status(400).json({ error: 'notificationId and websiteId are required' });
    }

    if (token) {
      const decodedToken = verifyNotificationToken(token);
      if (!decodedToken ||
        decodedToken.notificationId !== notificationId ||
        decodedToken.websiteId !== websiteId ||
        decodedToken.action !== 'error') {
        return res.status(401).json({ error: 'Invalid tracking token' });
      }
    } else {
      console.warn(`Notification error reporting without token: ID=${notificationId}, Website=${websiteId}`);
    }

    console.log(`Reporting notification error: ID=${notificationId}, Error=${error}`);

    // C-1 FIX: Atomic SQL increment
    const result = await sql`
      UPDATE notifications 
      SET "failedCount" = COALESCE("failedCount", 0) + 1,
          "lastError" = ${error}
      WHERE id = ${notificationId}
      RETURNING id
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (endpoint) {
      try {
        // Get current subscription to safely increment failedCount
        const { data: sub } = await db
          .from('subscriptions')
          .select('failedCount')
          .eq('endpoint', endpoint)
          .single();

        await db
          .from('subscriptions')
          .update({
            lastFailedDelivery: timestamp,
            lastError: error,
            failedCount: (sub?.failedCount || 0) + 1,
          })
          .eq('endpoint', endpoint);
      } catch (subError) {
        console.log('Error updating subscription error stats (non-critical):', subError);
      }
    }

    if (global.io) {
      global.io.emit('stats_update', { type: 'error', notificationId, websiteId });
    }

    res.status(200).json({ success: true, message: 'Notification error reported successfully' });
  } catch (err) {
    console.error('Error in report-notification-error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Report Notification Error (GET) ─────────────────────────
router.get('/report-notification-error', async (req, res) => {
  console.log('/report-notification-error (GET method)');

  try {
    const notificationId = req.query.notificationId;
    const websiteId = req.query.websiteId;
    const endpoint = req.query.endpoint;
    const error = req.query.error || 'Unknown error';
    const timestamp = req.query.timestamp || new Date().toISOString();

    if (!notificationId || !websiteId) {
      return res.status(400).json({ error: 'notificationId and websiteId are required' });
    }

    // C-1 FIX: Atomic SQL increment
    const result = await sql`
      UPDATE notifications 
      SET "failedCount" = COALESCE("failedCount", 0) + 1,
          "lastError" = ${error}
      WHERE id = ${notificationId}
      RETURNING id
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (endpoint) {
      try {
        const { data: sub } = await db
          .from('subscriptions')
          .select('failedCount')
          .eq('endpoint', endpoint)
          .single();

        await db
          .from('subscriptions')
          .update({
            lastFailedDelivery: timestamp,
            lastError: error,
            failedCount: (sub?.failedCount || 0) + 1,
          })
          .eq('endpoint', endpoint);
      } catch (subError) {
        console.log('Error updating subscription error stats (non-critical):', subError);
      }
    }

    if (global.io) {
      global.io.emit('stats_update', { type: 'error', notificationId, websiteId });
    }

    res.status(200).json({ success: true, message: 'Notification error reported successfully' });
  } catch (err) {
    console.error('Error in report-notification-error (GET):', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
