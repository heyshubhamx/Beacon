/**
 * Website Routes
 * 
 * CRUD operations for websites, config, stats, prompt settings.
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { db, websites, subscriptions, sql } = require('../../db');
const { settings } = require('../../db');
const { generateSubscriptionToken } = require('../../subscription-auth');
const { generateWebsiteId } = require('../utils/helpers');

// Add website (protected by global authenticateApiKey middleware)
router.post('/add-website', async (req, res) => {
  const domain = req.body.domain;

  if (!domain) {
    return res.status(400).json({ error: 'Domain is required' });
  }

  const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i;
  if (!domainRegex.test(domain)) {
    return res.status(400).json({ error: 'Invalid domain format' });
  }

  try {
    const { data: existingWebsites, error } = await db
      .from('websites')
      .select('id')
      .eq('domain', domain);

    if (error) {
      console.error('Error checking existing website:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (existingWebsites && existingWebsites.length > 0) {
      return res.status(409).json({
        error: 'Domain already registered',
        websiteId: existingWebsites[0].id,
      });
    }

    let newId = generateWebsiteId();
    const { data: existingIds, error: idError } = await db
      .from('websites')
      .select('id')
      .eq('id', newId);

    if (idError) {
      console.error('Error checking existing website ID:', idError);
      return res.status(500).json({ error: 'Internal server error' });
    }

    while (existingIds && existingIds.length > 0) {
      newId = generateWebsiteId();
      const { data: recheckIds } = await db
        .from('websites')
        .select('id')
        .eq('id', newId);
      if (!recheckIds || recheckIds.length === 0) break;
    }

    const signingSecret = crypto.randomBytes(32).toString('hex');

    const websiteData = {
      id: newId,
      domain,
      active: true,
      signingSecret, // BUG-07 FIX: Was generated but never saved to DB
    };

    const { error: insertError } = await db
      .from('websites')
      .insert([websiteData]);

    if (insertError) {
      console.error('Error inserting website:', insertError);
      return res.status(500).json({ error: 'Internal server error' });
    }

    res.json({
      success: true,
      domain,
      websiteId: newId,
      message: 'Website registered successfully',
    });
  } catch (error) {
    console.error('Error in add-website:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all websites
router.get('/websites', async (req, res) => {
  try {
    const allWebsites = await websites.getAll();
    res.json(allWebsites);
  } catch (error) {
    console.error('Error in get-websites:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get VAPID public key (global)
router.get('/vapidPublicKey', (req, res) => {
  const config = require('../config');
  res.send({ publicKey: config.vapid.publicKey });
});

// Get VAPID public key (website-specific path)
router.get('/website/:id/vapidPublicKey', (req, res) => {
  const config = require('../config');
  res.send({ publicKey: config.vapid.publicKey });
});

// Get subscription token for a website
router.get('/website/:id/subscription-token', async (req, res) => {
  try {
    const websiteId = req.params.id;
    const origin = req.get('Origin') || '';

    const website = await websites.getById(websiteId);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    const websiteDomain = website.domain.toLowerCase();
    if (!origin.toLowerCase().includes(websiteDomain) &&
      !origin.includes('localhost') &&
      !origin.includes('127.0.0.1')) {
      console.warn(`Origin mismatch: ${origin} does not match ${websiteDomain}`);
    }

    const token = await generateSubscriptionToken(websiteId);
    res.json({ token });
  } catch (error) {
    console.error('Error generating subscription token:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get website details
router.get('/website/:id', async (req, res) => {
  const websiteId = req.params.id;

  try {
    const website = await websites.getById(websiteId);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    const { data: subscriptionData, error: countError } = await db
      .from('subscriptions')
      .select('id')
      .eq('websiteId', websiteId);

    const subscriptionCount = countError ? 0 : (subscriptionData ? subscriptionData.length : 0);

    res.json({ ...website, subscriptionCount });
  } catch (error) {
    console.error('Error in get-website:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get website statistics
router.get('/website/:id/stats', async (req, res) => {
  const websiteId = req.params.id;

  try {
    const website = await websites.getById(websiteId);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    // Perform parallel SQL aggregations for speed
    const [
      browserRes,
      platformRes,
      countryRes,
      osRes,
      deviceRes,
      activityRes,
      basicStatsRes
    ] = await Promise.all([
      sql`SELECT COALESCE(browser, 'Unknown') as name, COUNT(*)::int as count FROM subscriptions WHERE "websiteId" = ${websiteId} GROUP BY browser`,
      sql`SELECT COALESCE(platform, 'Unknown') as name, COUNT(*)::int as count FROM subscriptions WHERE "websiteId" = ${websiteId} GROUP BY platform`,
      sql`SELECT COALESCE(country, 'Unknown') as name, COUNT(*)::int as count FROM subscriptions WHERE "websiteId" = ${websiteId} GROUP BY country`,
      sql`SELECT COALESCE(os, 'Unknown') as name, COUNT(*)::int as count FROM subscriptions WHERE "websiteId" = ${websiteId} GROUP BY os`,
      sql`SELECT CASE WHEN "isMobile" THEN 'mobile' ELSE 'desktop' END as name, COUNT(*)::int as count FROM subscriptions WHERE "websiteId" = ${websiteId} GROUP BY "isMobile"`,
      sql`SELECT 
            COUNT(*)::int as total,
            COUNT(*) FILTER (WHERE "lastUsed" >= NOW() - INTERVAL '7 days')::int as lastWeek,
            COUNT(*) FILTER (WHERE "lastUsed" >= NOW() - INTERVAL '30 days')::int as lastMonth
          FROM subscriptions WHERE "websiteId" = ${websiteId}`,
      sql`SELECT 
            COUNT(*)::int as total,
            COALESCE(SUM("sentCount"), 0)::int as sent,
            COALESCE(SUM("failedCount"), 0)::int as failed
          FROM notifications WHERE "websiteId" = ${websiteId}`
    ]);

    const browsers = {};
    browserRes.forEach(r => browsers[r.name] = r.count);
    const platforms = {};
    platformRes.forEach(r => platforms[r.name] = r.count);
    const countries = {};
    countryRes.forEach(r => countries[r.name] = r.count);
    const os = {};
    osRes.forEach(r => os[r.name] = r.count);
    
    const devices = { mobile: 0, desktop: 0 };
    deviceRes.forEach(r => devices[r.name] = r.count);

    const activity = {
      activeLastWeek: activityRes[0].lastweek,
      activeLastMonth: activityRes[0].lastmonth,
      totalActive: activityRes[0].total
    };

    const notifications = {
      total: basicStatsRes[0].sent,
      successful: basicStatsRes[0].sent - basicStatsRes[0].failed,
      failed: basicStatsRes[0].failed
    };

    const completeStats = {
      browsers,
      platforms,
      countries,
      os,
      devices,
      activity,
      notifications,
      activeSubscriptions: activity.totalActive,
      generatedAt: new Date().toISOString(),
    };

    await websites.updateStats(websiteId, completeStats);
    res.json(completeStats);
  } catch (error) {
    console.error('Error in get-website-stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get website prompt configuration
router.get('/website/:id/config', async (req, res) => {
  const websiteId = req.params.id;
  console.log(`Fetching config for website ID: ${websiteId}`);

  try {
    const website = await websites.getById(websiteId);
    if (!website) {
      console.log(`Website not found: ${websiteId}`);
      return res.status(404).json({ error: 'Website not found' });
    }

    // CORS is handled globally by corsMiddleware

    const promptConfig = website.promptConfig || {
      type: 'slide',
      text: 'Subscribe to our notifications for the latest news and updates. You can disable anytime.',
      acceptButtonText: 'Subscribe',
      rejectButtonText: 'Later',
      position: 'bottom-right',
      delay: 2000,
      colors: {
        background: '#ffffff',
        text: '#333333',
        acceptButton: '#4285f4',
        acceptButtonText: '#ffffff',
        rejectButton: 'transparent',
        rejectButtonText: '#6c757d',
      },
    };

    console.log(`Returning config for website ID: ${websiteId}`);
    return res.json(promptConfig);
  } catch (error) {
    console.error('Error in get-website-config:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update website prompt configuration
router.post('/website/:id/config', async (req, res) => {
  const websiteId = req.params.id;

  try {
    const website = await websites.getById(websiteId);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    const promptConfig = req.body.promptConfig;
    if (!promptConfig) {
      return res.status(400).json({ error: 'Prompt configuration is required' });
    }

    await websites.updateConfig(websiteId, promptConfig);
    res.json({ success: true, message: 'Prompt configuration updated successfully' });
  } catch (error) {
    console.error('Error in update-website-config:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a website
router.delete('/website/:id', async (req, res) => {
  const websiteId = req.params.id;

  try {
    const website = await websites.getById(websiteId);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    try {
      await subscriptions.removeByWebsiteId(websiteId);
      console.log(`Deleted all subscriptions for website ${websiteId}`);
    } catch (error) {
      console.error(`Error deleting subscriptions for website ${websiteId}:`, error);
    }

    await websites.delete(websiteId);
    console.log(`Deleted website ${websiteId}`);

    res.json({ success: true, message: 'Website and all associated subscriptions deleted successfully' });
  } catch (error) {
    console.error('Error in delete-website:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Toggle website active status
router.post('/website/:id/toggle-status', async (req, res) => {
  const websiteId = req.params.id;

  try {
    const website = await websites.getById(websiteId);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    const newStatus = !website.active;
    await websites.update(websiteId, { active: newStatus });

    res.json({
      id: websiteId,
      domain: website.domain,
      active: newStatus,
      message: `Website ${newStatus ? 'activated' : 'deactivated'} successfully`,
    });
  } catch (error) {
    console.error('Error in toggle-website-status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get/Update prompt position
router.get('/website/:id/prompt-position', async (req, res) => {
  const websiteId = req.params.id;
  try {
    const website = await websites.getById(websiteId);
    if (!website) return res.status(404).json({ error: 'Website not found' });
    const promptConfig = website.promptConfig || { type: 'slide', position: 'bottom-right' };
    res.json({ type: promptConfig.type || 'slide', position: promptConfig.position || 'bottom-right' });
  } catch (error) {
    console.error('Error in get-prompt-position:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/website/:id/prompt-position', async (req, res) => {
  const websiteId = req.params.id;
  try {
    const website = await websites.getById(websiteId);
    if (!website) return res.status(404).json({ error: 'Website not found' });

    const { type, position } = req.body;
    if (!type || !position) return res.status(400).json({ error: 'Both prompt type and position are required' });

    const validTypes = ['slide', 'modal', 'native'];
    if (!validTypes.includes(type)) return res.status(400).json({ error: 'Invalid prompt type' });

    const validPositions = ['top-left', 'top-middle', 'top-right', 'bottom-left', 'bottom-right'];
    if (!validPositions.includes(position)) return res.status(400).json({ error: 'Invalid position' });

    const promptConfig = website.promptConfig || {};
    promptConfig.type = type;
    promptConfig.position = position;
    await websites.updateConfig(websiteId, promptConfig);

    res.json({ success: true, type, position, message: 'Prompt position updated successfully' });
  } catch (error) {
    console.error('Error in update-prompt-position:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get/Update prompt text
router.get('/website/:id/prompt-text', async (req, res) => {
  const websiteId = req.params.id;
  try {
    const website = await websites.getById(websiteId);
    if (!website) return res.status(404).json({ error: 'Website not found' });
    const promptConfig = website.promptConfig || {};
    res.json({
      text: promptConfig.text || 'Subscribe to our notifications for the latest news and updates. You can disable anytime.',
      acceptButtonText: promptConfig.acceptButtonText || 'Subscribe',
      rejectButtonText: promptConfig.rejectButtonText || 'Later',
    });
  } catch (error) {
    console.error('Error in get-prompt-text:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/website/:id/prompt-text', async (req, res) => {
  const websiteId = req.params.id;
  try {
    const website = await websites.getById(websiteId);
    if (!website) return res.status(404).json({ error: 'Website not found' });

    const { text, acceptButtonText, rejectButtonText } = req.body;
    if (!text) return res.status(400).json({ error: 'Prompt text is required' });

    const promptConfig = website.promptConfig || {};
    promptConfig.text = text;
    if (acceptButtonText) promptConfig.acceptButtonText = acceptButtonText;
    if (rejectButtonText) promptConfig.rejectButtonText = rejectButtonText;
    await websites.updateConfig(websiteId, promptConfig);

    res.json({
      success: true,
      text,
      acceptButtonText: promptConfig.acceptButtonText,
      rejectButtonText: promptConfig.rejectButtonText,
      message: 'Prompt text updated successfully',
    });
  } catch (error) {
    console.error('Error in update-prompt-text:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get/Update prompt appearance
router.get('/website/:id/prompt-appearance', async (req, res) => {
  const websiteId = req.params.id;
  try {
    const website = await websites.getById(websiteId);
    if (!website) return res.status(404).json({ error: 'Website not found' });
    const promptConfig = website.promptConfig || {};
    const defaultColors = {
      background: '#ffffff', text: '#333333', acceptButton: '#4285f4',
      acceptButtonText: '#ffffff', rejectButton: 'transparent', rejectButtonText: '#6c757d',
    };
    res.json({ colors: promptConfig.colors || defaultColors });
  } catch (error) {
    console.error('Error in get-prompt-appearance:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/website/:id/prompt-appearance', async (req, res) => {
  const websiteId = req.params.id;
  try {
    const website = await websites.getById(websiteId);
    if (!website) return res.status(404).json({ error: 'Website not found' });

    const { colors } = req.body;
    if (!colors) return res.status(400).json({ error: 'Colors object is required' });

    const promptConfig = website.promptConfig || {};
    promptConfig.colors = promptConfig.colors || {};
    if (colors.background) promptConfig.colors.background = colors.background;
    if (colors.text) promptConfig.colors.text = colors.text;
    if (colors.acceptButton) promptConfig.colors.acceptButton = colors.acceptButton;
    if (colors.acceptButtonText) promptConfig.colors.acceptButtonText = colors.acceptButtonText;
    if (colors.rejectButton) promptConfig.colors.rejectButton = colors.rejectButton;
    if (colors.rejectButtonText) promptConfig.colors.rejectButtonText = colors.rejectButtonText;
    await websites.updateConfig(websiteId, promptConfig);

    res.json({ success: true, colors: promptConfig.colors, message: 'Prompt appearance updated successfully' });
  } catch (error) {
    console.error('Error in update-prompt-appearance:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Track prompt event
router.post('/website/:id/prompt-event', async (req, res) => {
  const websiteId = req.params.id;
  const { event } = req.body;

  if (!event) return res.status(400).json({ error: 'Event type is required' });
  if (!['impression', 'allow', 'later'].includes(event)) {
    return res.status(400).json({ error: 'Invalid event type. Must be one of: impression, allow, later' });
  }

  try {
    const website = await websites.getById(websiteId);
    if (!website) return res.status(404).json({ error: 'Website not found' });
    await websites.trackPromptEvent(websiteId, event);
    res.json({ success: true });
  } catch (error) {
    console.error('Error tracking prompt event:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get prompt metrics (protected by global authenticateApiKey middleware)
router.get('/website/:id/prompt-metrics', async (req, res) => {
  const websiteId = req.params.id;

  try {
    const metrics = await websites.getPromptMetrics(websiteId);
    let conversionRate = 0;
    if (metrics.impressions > 0) {
      conversionRate = (metrics.allowed / metrics.impressions) * 100;
    }

    res.json({ ...metrics, conversionRate: parseFloat(conversionRate.toFixed(2)) });
  } catch (error) {
    console.error('Error getting prompt metrics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
