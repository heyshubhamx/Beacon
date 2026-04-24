/**
 * Notification Sending Routes
 * 
 * Handles /notify-site, /notify-all, /notify-multiple, /notify-me,
 * and scheduled notification processing + cleanup endpoints.
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { db, subscriptions } = require('../../db');
const { sendNotifications, cleanExpiredSubscriptions } = require('../services/pushService');
const { processScheduledNotifications } = require('../services/schedulerService');
const { enqueueNotificationJob } = require('../workers/pushWorker');

// Send notification to a specific subscription
router.post('/notify-me', async (req, res) => {
  console.log('/notify-me');

  const subscription = req.body.subscription || req.body;
  console.log(`Notifying ${subscription.endpoint}`);

  try {
    const storedSubscription = await subscriptions.getByEndpoint(subscription.endpoint);
    if (!storedSubscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    const result = await sendNotifications([storedSubscription], req.body.notification);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error in notify-me:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send notification to all subscriptions for a specific website
router.post('/notify-site', async (req, res) => {
  console.log('/notify-site');

  const websiteId = req.body.websiteId || req.query.websiteId;
  const website = req.website; // Set by auth middleware
  const campaignData = req.body.campaign || null;

  console.log(`Handling notification request for website ID ${websiteId} (${website.domain})`);

  try {
    // Handle draft notifications
    if (campaignData && campaignData.status === 'draft') {
      console.log('Saving notification as draft');

      const notificationData = {
        websiteId,
        title: req.body.notification?.title || req.body.title,
        body: req.body.notification?.options?.body || req.body.body,
        icon: req.body.notification?.options?.icon,
        image: req.body.notification?.options?.image,
        url: req.body.notification?.options?.data?.url,
        status: 'draft',
        timestamp: new Date().toISOString(),
        scheduledFor: campaignData.scheduledFor || null,
        data: {
          ...(req.body.notification?.options?.data || {}),
          campaign: { name: campaignData.name, description: campaignData.description },
        },
      };

      const { data, error } = await db
        .from('notifications')
        .insert(notificationData)
        .select('id')
        .single();

      if (error) {
        console.error('Error saving draft notification:', error);
        return res.status(500).json({ error: 'Failed to save draft notification' });
      }

      return res.status(200).json({ id: data.id, status: 'draft', message: 'Notification saved as draft' });
    }

    // Handle scheduled notifications
    if (campaignData && campaignData.status === 'scheduled' && campaignData.scheduledFor) {
      const scheduledTime = new Date(campaignData.scheduledFor);
      const now = new Date();

      if (scheduledTime > now) {
        const istTime = scheduledTime.toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit', second: '2-digit',
        });
        console.log(`Scheduling notification for ${istTime} IST`);

        const notificationData = {
          websiteId,
          title: req.body.notification?.title || req.body.title,
          body: req.body.notification?.options?.body || req.body.body,
          icon: req.body.notification?.options?.icon,
          image: req.body.notification?.options?.image,
          url: req.body.notification?.options?.data?.url,
          status: 'scheduled',
          timestamp: new Date().toISOString(),
          scheduledFor: campaignData.scheduledFor,
          data: {
            ...(req.body.notification?.options?.data || {}),
            campaign: { name: campaignData.name, description: campaignData.description },
          },
        };

        if (req.body.notification?.options?.actions && req.body.notification.options.actions.length > 0) {
          notificationData.data.actions = req.body.notification.options.actions;
        }

        const { data, error } = await db
          .from('notifications')
          .insert(notificationData)
          .select('id')
          .single();

        if (error) {
          console.error('Error scheduling notification:', error);
          return res.status(500).json({ error: 'Failed to schedule notification' });
        }

        return res.status(200).json({
          id: data.id,
          status: 'scheduled',
          scheduledFor: campaignData.scheduledFor,
          scheduledForIST: istTime,
          message: `Notification scheduled for ${istTime} IST`,
        });
      }
    }

    // Immediate sending
    console.log('Enqueueing notification job...');
    
    const jobData = {
      websiteId,
      notificationPayload: req.body.notification || req.body,
      campaignData
    };
    
    // Create a deterministic jobId if we have a campaign ID to prevent dupe enqueues
    if (campaignData && campaignData.id) {
      jobData.deterministicId = `notify_site_${websiteId}_${campaignData.id}`;
    } else {
      jobData.deterministicId = `notify_site_${websiteId}_${Date.now()}`;
    }

    const job = await enqueueNotificationJob(jobData);

    res.status(202).json({
      success: true,
      id: job.id || 'enqueued',
      jobId: job.id,
      message: 'Notification enqueued for processing',
      status: 'enqueued'
    });
  } catch (error) {
    console.error('Error in notify-site:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send notification to multiple websites
router.post('/notify-multiple', async (req, res) => {
  console.log('/notify-multiple');

  const websiteIds = req.body.websiteIds || [];
  const campaignData = req.body.campaign || null;

  if (!websiteIds || websiteIds.length === 0) {
    return res.status(400).json({ error: 'No websites selected' });
  }

  try {
    // Handle draft
    if (campaignData && campaignData.status === 'draft') {
      const notificationData = websiteIds.map((wId) => ({
        websiteId: wId,
        title: req.body.notification?.title || req.body.title,
        body: req.body.notification?.options?.body || req.body.body,
        icon: req.body.notification?.options?.icon,
        image: req.body.notification?.options?.image,
        url: req.body.notification?.options?.data?.url,
        status: 'draft',
        timestamp: new Date().toISOString(),
        scheduledFor: campaignData.scheduledFor || null,
        data: {
          ...(req.body.notification?.options?.data || {}),
          campaign: { name: campaignData.name, description: campaignData.description },
        },
      }));

      const { data, error } = await db
        .from('notifications')
        .insert(notificationData)
        .select('id');

      if (error) {
        console.error('Error saving draft notifications:', error);
        return res.status(500).json({ error: 'Failed to save draft notifications' });
      }

      return res.status(200).json({
        ids: data.map((d) => d.id),
        status: 'draft',
        message: `Notifications saved as draft for ${websiteIds.length} websites`,
      });
    }

    // Handle scheduled
    if (campaignData && campaignData.status === 'scheduled' && campaignData.scheduledFor) {
      const scheduledTime = new Date(campaignData.scheduledFor);
      const now = new Date();

      if (scheduledTime > now) {
        const istTime = scheduledTime.toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit', second: '2-digit',
        });

        const notificationData = websiteIds.map((wId) => ({
          websiteId: wId,
          title: req.body.notification?.title || req.body.title,
          body: req.body.notification?.options?.body || req.body.body,
          icon: req.body.notification?.options?.icon,
          image: req.body.notification?.options?.image,
          url: req.body.notification?.options?.data?.url,
          status: 'scheduled',
          timestamp: new Date().toISOString(),
          scheduledFor: campaignData.scheduledFor,
          data: {
            ...(req.body.notification?.options?.data || {}),
            campaign: { name: campaignData.name, description: campaignData.description },
          },
        }));

        if (req.body.notification?.options?.actions && req.body.notification.options.actions.length > 0) {
          notificationData.forEach((n) => { n.data.actions = req.body.notification.options.actions; });
        }

        const { data, error } = await db
          .from('notifications')
          .insert(notificationData)
          .select('id');

        if (error) {
          console.error('Error scheduling notifications:', error);
          return res.status(500).json({ error: 'Failed to schedule notifications' });
        }

        return res.status(200).json({
          ids: data.map((d) => d.id),
          status: 'scheduled',
          scheduledFor: campaignData.scheduledFor,
          scheduledForIST: istTime,
          message: `Notifications scheduled for ${websiteIds.length} websites for ${istTime} IST`,
        });
      }
    }

    // Immediate sending
    console.log('Enqueueing notifications for multiple sites...');
    const jobs = [];
    const groupId = crypto.randomUUID();
    
    for (const wId of websiteIds) {
      const jobData = {
        websiteId: wId,
        notificationPayload: req.body.notification || req.body,
        campaignData: {
          ...campaignData,
          groupId
        }
      };
      
      const job = await enqueueNotificationJob(jobData);
      jobs.push(job.id);
    }

    res.status(202).json({
      success: true,
      id: jobs[0] || 'multiple-enqueued',
      jobIds: jobs,
      message: `Enqueued jobs for ${websiteIds.length} websites`,
      status: 'enqueued'
    });
  } catch (error) {
    console.error('Error in notify-multiple:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send notification to all subscriptions
router.post('/notify-all', async (req, res) => {
  console.log('/notify-all');

  try {
    // Ideally we would get all unique website IDs and enqueue one job per website.
    // For now, enqueue a global fallback job (requires modifying pushWorker logic)
    // Actually, it's safer to fetch unique websiteIds and send jobs per website.
    const { data: allSites, error } = await db
      .from('websites')
      .select('id')
      .eq('active', true);

    if (error) {
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    const jobs = [];
    const groupId = crypto.randomUUID();

    for (const site of allSites) {
      const job = await enqueueNotificationJob({
        websiteId: site.id,
        notificationPayload: req.body.notification || req.body,
        campaignData: {
          groupId
        }
      });
      jobs.push(job.id);
    }

    res.status(202).json({
      success: true,
      id: jobs[0] || 'all-enqueued',
      jobIds: jobs,
      message: `Enqueued jobs across ${allSites.length} websites`,
      status: 'enqueued'
    });
  } catch (error) {
    console.error('Error in notify-all:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Clean expired subscriptions (POST)
router.post('/clean-expired-subscriptions', async (req, res) => {
  console.log('/clean-expired-subscriptions (POST)');
  try {
    const result = await cleanExpiredSubscriptions(req.body.websiteId);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error in clean-expired-subscriptions POST:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Clean expired subscriptions (GET — for cron jobs)
router.get('/clean-expired-subscriptions', async (req, res) => {
  console.log('/clean-expired-subscriptions (GET)');
  try {
    const result = await cleanExpiredSubscriptions(req.query.websiteId);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error in clean-expired-subscriptions GET:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Process scheduled notifications (for cron jobs)
router.get('/process-scheduled-notifications', async (req, res) => {
  console.log('Process scheduled notifications endpoint called');
  try {
    const result = await processScheduledNotifications();
    res.status(200).json(result);
  } catch (error) {
    console.error('Error processing scheduled notifications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
