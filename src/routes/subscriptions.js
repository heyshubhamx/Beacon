/**
 * Subscription Routes
 * 
 * Handles add, update, and remove subscription endpoints.
 */

const express = require('express');
const router = express.Router();
const { db, websites, subscriptions } = require('../../db');
const { settings } = require('../../db');
const { verifySubscriptionToken } = require('../../subscription-auth');
const { parseBrowserInfo } = require('../utils/browserParser');
const crypto = require('crypto');

/**
 * Middleware: check for admin API key or subscription token
 */
async function checkSubAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const apiKey = authHeader.split(' ')[1];
    try {
      const validPassword = process.env.DASHBOARD_PASSWORD;
      if (apiKey === validPassword) {
        console.log('Admin API key detected, bypassing subscription token verification');
        return next();
      }
    } catch (error) {
      console.error('Error checking API key:', error);
    }
  }
  // Not an admin request, verify subscription token
  verifySubscriptionToken(req, res, next);
}

// Add subscription
router.post('/add-subscription', checkSubAuth, async (req, res) => {
  console.log('/add-subscription - Request received');

  const subscription = req.body.subscription;
  const websiteId = req.body.websiteId;

  if (!subscription || !websiteId) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  const websiteIdStr = String(websiteId);

  try {
    // If admin request, get the website
    if (!req.website) {
      const website = await websites.getById(websiteIdStr);
      if (!website) {
        return res.status(404).json({ error: 'Website not found' });
      }
      req.website = website;
    }

    const website = req.website;
    console.log(`Processing subscription for website ${websiteIdStr} (${website.domain})`);

    // Generate endpoint ID (last part of the endpoint URL)
    const endpointParts = subscription.endpoint.split('/');
    const endpointId = endpointParts[endpointParts.length - 1];

    console.log(`Subscribing ${subscription.endpoint} for website ${website.domain} (ID: ${websiteIdStr})`);

    // Extract useful information from headers for statistics
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const browserInfo = parseBrowserInfo(userAgent);
    const country = req.headers['cf-ipcountry'] || 'Unknown';
    const ip = (req.headers['cf-connecting-ip'] ||
      req.headers['x-forwarded-for'] ||
      req.ip || 'Unknown').split(',')[0].trim();
    const referrer = req.headers['referer'] || 'Direct';
    const platform = req.headers['sec-ch-ua-platform'] ?
      req.headers['sec-ch-ua-platform'].replace(/"/g, '') :
      'Unknown';
    const isMobile = req.headers['sec-ch-ua-mobile'] === '?1';

    // Generate tokenHash for cross-user/cross-device deduplication tracking
    const tokenHash = crypto.createHash('sha256').update(subscription.endpoint).digest('hex');

    // Check if subscription already exists
    const existingSubscription = await subscriptions.getByEndpoint(subscription.endpoint);

    if (existingSubscription) {
      if (existingSubscription.websiteId === websiteIdStr) {
        console.log(`Subscription already exists for this website: ${subscription.endpoint}`);
        await subscriptions.update(subscription.endpoint, {
          lastUsed: new Date().toISOString(),
          tokenHash, // Retroactively attach the hash to old rows
        });
        return res.status(200).json({ success: true, message: 'Subscription already exists' });
      } else {
        // Option to deduplicate across websites if needed, but standard is just updating the existing one:
        // Actually, we keep subscriptions separate per website.
      }
    }
    
    // Additional cleanup: identify any lingering stale tokenHashes for this exact website
    // to prevent virtual subscription duplication
    try {
      await db
        .from('subscriptions')
        .delete()
        .eq('tokenHash', tokenHash)
        .eq('websiteId', websiteIdStr);
    } catch (err) {
      console.log('Skipping tokenHash cleanup (schema might not be updated yet)');
    }

    // Add subscription to database with enhanced data
    const subscriptionData = {
      id: endpointId,
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      websiteId: websiteIdStr,
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString(),
      userAgent,
      browser: browserInfo.browser,
      browserVersion: browserInfo.version,
      os: browserInfo.os,
      country,
      ip,
      referrer,
      platform,
      isMobile,
      tokenHash,
      metadata: req.body.metadata || {},
    };

    await subscriptions.add(subscriptionData);

    // Get current website stats (handle double-serialized JSON from migration)
    let rawStats = website.stats;
    if (typeof rawStats === 'string') {
      try { rawStats = JSON.parse(rawStats); } catch(e) { rawStats = {}; }
    }
    let websiteStats = rawStats || {};
    websiteStats.totalSubscriptions = websiteStats.totalSubscriptions || 0;
    websiteStats.activeSubscriptions = websiteStats.activeSubscriptions || 0;
    websiteStats.platforms = websiteStats.platforms || {};
    websiteStats.browsers = websiteStats.browsers || {};
    websiteStats.countries = websiteStats.countries || {};

    websiteStats.totalSubscriptions = (websiteStats.totalSubscriptions || 0) + 1;

    // Get count of active subscriptions for this website
    const { data: activeSubscriptions, error: countError } = await db
      .from('subscriptions')
      .select('id')
      .eq('websiteId', websiteIdStr);

    if (!countError) {
      websiteStats.activeSubscriptions = activeSubscriptions.length;
    }

    // Update platform/browser/country stats
    if (platform) websiteStats.platforms[platform] = (websiteStats.platforms[platform] || 0) + 1;
    if (browserInfo.browser) websiteStats.browsers[browserInfo.browser] = (websiteStats.browsers[browserInfo.browser] || 0) + 1;
    if (country) websiteStats.countries[country] = (websiteStats.countries[country] || 0) + 1;

    await websites.updateStats(websiteIdStr, websiteStats);

    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Error in add-subscription:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update subscription when it changes
router.post('/update-subscription', checkSubAuth, async (req, res) => {
  console.log('/update-subscription');

  const oldSubscription = req.body.oldSubscription;
  const newSubscription = req.body.subscription;
  const websiteId = req.body.websiteId ? String(req.body.websiteId) : null;

  if (!oldSubscription || !oldSubscription.endpoint || !newSubscription || !newSubscription.endpoint) {
    return res.status(400).json({ error: 'Both old and new subscription details are required' });
  }

  try {
    const { data: oldSubs, error } = await db
      .from('subscriptions')
      .select('*')
      .eq('endpoint', oldSubscription.endpoint);

    if (error) {
      console.error('Error finding old subscription:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (!oldSubs || oldSubs.length === 0) {
      console.log(`Old subscription ${oldSubscription.endpoint} not found`);

      if (websiteId) {
        if (!req.website) {
          const website = await websites.getById(websiteId);
          if (!website) {
            return res.status(404).json({ error: 'Website not found' });
          }
          req.website = website;
        }

        await subscriptions.add({
          ...newSubscription,
          websiteId,
          createdAt: new Date().toISOString(),
          lastUsed: new Date().toISOString(),
        });

        console.log(`Added new subscription ${newSubscription.endpoint} for website ${websiteId}`);
      }

      return res.sendStatus(200);
    }

    for (const oldSub of oldSubs) {
      if (websiteId && oldSub.websiteId !== websiteId) {
        continue;
      }

      await db
        .from('subscriptions')
        .delete()
        .eq('endpoint', oldSubscription.endpoint)
        .eq('websiteId', oldSub.websiteId);

      await subscriptions.add({
        ...newSubscription,
        websiteId: oldSub.websiteId,
        createdAt: oldSub.createdAt,
        lastUsed: new Date().toISOString(),
      });

      console.log(`Updated subscription from ${oldSubscription.endpoint} to ${newSubscription.endpoint} for website ${oldSub.websiteId}`);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Error in update-subscription:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove subscription
router.post('/remove-subscription', checkSubAuth, async (req, res) => {
  console.log('/remove-subscription');

  const subscription = req.body.subscription || req.body;
  const websiteId = req.body.websiteId;

  console.log(`Unsubscribing ${subscription.endpoint}`);

  try {
    if (websiteId) {
      await db
        .from('subscriptions')
        .delete()
        .eq('endpoint', subscription.endpoint)
        .eq('websiteId', websiteId);
    } else {
      await db
        .from('subscriptions')
        .delete()
        .eq('endpoint', subscription.endpoint);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Error in remove-subscription:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all subscriptions (paginated)
router.get('/subscriptions', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const { data: countData, error: countError } = await db
      .from('subscriptions')
      .select('id', { count: 'exact' });

    if (countError) {
      console.error('Error counting subscriptions:', countError);
      return res.status(500).json({ error: 'Internal server error' });
    }

    const totalCount = countData ? countData.length : 0;

    const { data, error } = await db
      .from('subscriptions')
      .select('*')
      .range(offset, offset + limit - 1)
      .order('createdAt', { ascending: false });

    if (error) {
      console.error('Error fetching subscriptions:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }

    res.json({
      data: data || [],
      pagination: { total: totalCount, page, limit, pages: Math.ceil(totalCount / limit) },
    });
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
