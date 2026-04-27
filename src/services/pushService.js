/**
 * Push Notification Service
 * 
 * Handles the core logic for sending web push notifications,
 * including batching, error handling, and dead token cleanup.
 * Uses `node-webpush` for VAPID-based push delivery.
 */

const { Worker } = require('worker_threads');
const path = require('path');
const config = require('../config');
const { db, sql } = require('../../db');
const { generateNotificationToken } = require('../utils/tokenUtils');

const vapidDetails = {
  publicKey: config.vapid.publicKey,
  privateKey: config.vapid.privateKey,
  subject: config.vapid.subject,
};

/**
 * Send notifications to an array of subscriptions
 * @param {Array} subscriptionsArray - Array of subscription objects
 * @param {Object} customPayload - Notification payload
 * @param {Object} campaignData - Optional campaign metadata
 * @returns {Promise<Object>} - Result summary { notificationId, sent, failed, removed, totalBatches }
 */
async function sendNotifications(subscriptionsArray, customPayload = null, campaignData = null) {
  // Create the notification content
  const defaultNotification = {
    title: 'Push Notification',
    options: {
      body: `ID: ${Math.floor(Math.random() * 100)}`,
      icon: '/icon.png',
      badge: '/badge.png',
    },
  };

  // Use custom payload if provided
  const payload = customPayload || defaultNotification;

  // Store notification in database to track clicks
  const websiteId = subscriptionsArray.length > 0 ? subscriptionsArray[0].websiteId : null;

  // Create notification record in database
  let notificationId = null;
  try {
    const notificationData = {
      websiteId,
      title: payload.title,
      body: payload.options?.body,
      icon: payload.options?.icon,
      image: payload.options?.image,
      url: payload.options?.data?.url,
      tag: payload.options?.tag,
      timestamp: new Date().toISOString(),
      data: payload.options?.data || {},
    };

    // Add campaign data if provided
    if (campaignData) {
      notificationData.status = campaignData.status || 'sent';
      notificationData.scheduledFor = campaignData.scheduledFor || notificationData.timestamp;
      
      // Store the grouping ID if this is a multi-site blast
      if (campaignData.groupId) {
        notificationData.groupId = campaignData.groupId;
      }

      if (campaignData.name || campaignData.description) {
        if (!notificationData.data) notificationData.data = {};
        notificationData.data.campaign = {
          name: campaignData.name,
          description: campaignData.description,
        };
      }
    }

    const { data, error } = await db
      .from('notifications')
      .insert(notificationData)
      .select('id')
      .single();

    if (error) {
      console.error('Error creating notification record:', error);
    } else {
      notificationId = data.id;
      console.log(`Created notification record with ID: ${notificationId}`);

      // Add notification ID to the payload for click tracking
      if (!payload.options) payload.options = {};
      if (!payload.options.data) payload.options.data = {};

      payload.options.data.notificationId = notificationId;
      payload.options.data.websiteId = websiteId;

      // Generate secure tracking tokens for this notification
      payload.options.data.clickToken = generateNotificationToken(notificationId, websiteId, 'click');
      payload.options.data.deliveryToken = generateNotificationToken(notificationId, websiteId, 'delivery');
      payload.options.data.errorToken = generateNotificationToken(notificationId, websiteId, 'error');

      // Add campaign ID if it exists in the payload
      if (payload.options.data.campaignId) {
        console.log(`Campaign ID: ${payload.options.data.campaignId}`);
      } else {
        payload.options.data.campaignId = `campaign_${notificationId}_${Date.now()}`;
        console.log(`Generated new campaign ID: ${payload.options.data.campaignId}`);
      }

      // Add a unique tag to the notification to identify it
      payload.options.tag = `notification_${notificationId}`;

      // Clean empty string options from the payload to prevent Chrome rendering failures
      ['icon', 'image', 'badge'].forEach(prop => {
        if (payload.options[prop] === '') {
          delete payload.options[prop];
        }
      });
      if (payload.icon === '') delete payload.icon;
      if (payload.image === '') delete payload.image;
      
      // Chrome crashes if actions array is empty or if actions have missing critical properties
      if (Array.isArray(payload.options.actions)) {
        if (payload.options.actions.length === 0) {
          delete payload.options.actions;
        } else {
          // Filter out explicitly invalid actions
          payload.options.actions = payload.options.actions.filter(a => a.action && a.title);
          if (payload.options.actions.length === 0) delete payload.options.actions;
        }
      }

      console.log('Sending notification with payload:', JSON.stringify({
        title: payload.title,
        body: payload.options.body,
        trackingData: payload.options.data,
      }, null, 2));
    }
  } catch (error) {
    console.error('Error creating notification record:', error);
  }

  // Convert payload to JSON string
  const notification = JSON.stringify(payload);

  // Push options
  const options = {
    TTL: config.push.ttl,
    vapidDetails,
  };

  // Counters
  let removedCount = 0;
  let sentCount = 0;
  let failedCount = 0;
  const timestamp = new Date().toISOString();

  // Split subscriptions into chunks for worker threads
  const chunkSize = config.push.batchSize || 2500;
  const chunks = [];
  for (let i = 0; i < subscriptionsArray.length; i += chunkSize) {
    chunks.push(subscriptionsArray.slice(i, i + chunkSize));
  }

  // Cap max concurrent workers to prevent thread explosion
  const maxConcurrentWorkers = config.push.maxConcurrentWorkers || 4;
  const batchDelayMs = config.push.batchDelayMs || 500;

  console.log(`Dispatching ${chunks.length} worker batches (max ${maxConcurrentWorkers} concurrent) to process ${subscriptionsArray.length} subscriptions`);

  /**
   * Spawn a single worker thread and return a promise for its results.
   */
  function spawnWorker(chunk, index) {
    return new Promise((resolve, reject) => {
      const workerPath = path.join(__dirname, '..', 'workers', 'push-sender.worker.js');
      const worker = new Worker(workerPath, {
        workerData: {
          subscriptions: chunk,
          payload: notification,
          options,
          config: {
            vapid: vapidDetails,
            push: config.push,
          }
        }
      });

      worker.on('message', (msg) => {
        if (msg.success) {
          resolve(msg.results);
        } else {
          reject(new Error(msg.error));
        }
      });

      worker.on('error', reject);
      worker.on('exit', (code) => {
        if (code !== 0) {
          reject(new Error(`Worker stopped with exit code ${code}`));
        }
      });
    });
  }

  // Process worker chunks in waves of maxConcurrentWorkers with delay between waves
  const allThreadResults = [];
  for (let w = 0; w < chunks.length; w += maxConcurrentWorkers) {
    const wave = chunks.slice(w, w + maxConcurrentWorkers);
    const wavePromises = wave.map((chunk, idx) => spawnWorker(chunk, w + idx));
    const waveResults = await Promise.allSettled(wavePromises);
    allThreadResults.push(...waveResults);

    // Add a small delay between waves to let the system breathe
    if (w + maxConcurrentWorkers < chunks.length) {
      await new Promise(r => setTimeout(r, batchDelayMs));
    }
  }

  try {
    const threadResults = allThreadResults;
    
    // Aggregate results and prepare bulk DB updates
    const failedEndpointsToUpdate = [];
    const endpointsToRemove = [];
    const successfulEndpoints = [];

    for (const result of threadResults) {
      if (result.status === 'fulfilled' && result.value) {
        sentCount += result.value.sent || 0;
        failedCount += result.value.failed || 0;
        removedCount += result.value.removed || 0;
        
        if (result.value.successes) successfulEndpoints.push(...result.value.successes);
        if (result.value.expiredEndpoints) endpointsToRemove.push(...result.value.expiredEndpoints);
        if (result.value.failures) {
          failedEndpointsToUpdate.push(...result.value.failures);
          console.log('Worker detailed FCM failures:', JSON.stringify(result.value.failures, null, 2));
        }
      } else {
        console.error('Worker failed:', result.reason);
      }
    }

    // Now do DB updates efficiently using batching where possible
    console.log(`Beginning DB updates: ${successfulEndpoints.length} successes, ${endpointsToRemove.length} removals, ${failedEndpointsToUpdate.length} errors`);

    if (successfulEndpoints.length > 0) {
      // Supabase lacks proper bulk update for multiple rows by different values, 
      // but we can bulk update the same values if filtered using 'in'.
      // Update lastUsed and lastSuccessfulDelivery for all success endpoints
      try {
        // Chunk the 'in' queries to avoid URL limits in Supabase
        for (let i = 0; i < successfulEndpoints.length; i += 500) {
          const endpointsChunk = successfulEndpoints.slice(i, i + 500);
          await db
            .from('subscriptions')
            .update({
               lastUsed: timestamp,
               lastSuccessfulDelivery: timestamp
            })
            .in('endpoint', endpointsChunk);
        }
      } catch (err) {
         console.error('Error batch updating successes:', err);
      }
    }

    if (endpointsToRemove.length > 0) {
      try {
        for (let i = 0; i < endpointsToRemove.length; i += 500) {
          const endpointsChunk = endpointsToRemove.slice(i, i + 500);
          await db
            .from('subscriptions')
            .delete()
            .in('endpoint', endpointsChunk);
        }
      } catch (err) {
         console.error('Error batch deleting expired endpoints:', err);
      }
    }

    // Update failures individually to track specific error messages and increment count correctly
    // Better logic: since we can't do `.update({ failedCount: failedCount + 1 })` in Supabase without an RPC natively from JS,
    // we'll update them one by one like before or skip specific incrementing if too heavy.
    // Given worker mapping, we'd do a Promise.all with small concurrency
    // BUG-20 FIX: Use lazy batching with atomic SQL increments instead of eager .map(async)
    // The old code started ALL promises immediately, making the concurrency limiter useless.
    if (failedEndpointsToUpdate.length > 0) {
      const BATCH_SIZE = 50;
      for (let i = 0; i < failedEndpointsToUpdate.length; i += BATCH_SIZE) {
        const batch = failedEndpointsToUpdate.slice(i, i + BATCH_SIZE);
        // Create promises lazily — only this batch runs concurrently
        await Promise.allSettled(batch.map(async (failure) => {
          try {
            // Atomic increment — no read-then-write race condition
            await sql`
              UPDATE subscriptions 
              SET "lastFailedDelivery" = ${timestamp},
                  "failedCount" = COALESCE("failedCount", 0) + 1,
                  "lastError" = ${(failure.error || 'Unknown error').substring(0, 255)}
              WHERE endpoint = ${failure.endpoint}
            `;
          } catch (err) {
            // Silently continue — DB column may not exist
          }
        }));
      }
    }

  } catch (err) {
    console.error('Master Thread: Error dispatching workers:', err);
  }

  // Update notification record with final counts
  if (notificationId) {
    await db
      .from('notifications')
      .update({ sentCount, failedCount })
      .eq('id', notificationId);
  }

  console.log(`Notification sending complete: ${sentCount} sent, ${failedCount} failed, ${removedCount} removed`);

  return {
    notificationId,
    sent: sentCount,
    failed: failedCount,
    removed: removedCount,
    totalBatches: chunks.length,
  };
}

/**
 * Clean expired/invalid subscriptions by sending silent validation pushes.
 * @param {string|null} websiteId - Optional website ID to scope cleanup
 * @returns {Promise<Object>} - { message, total, cleaned }
 */
async function cleanExpiredSubscriptions(websiteId) {
  try {
    let subscriptionsToCheck;

    if (websiteId) {
      const { data, error } = await db
        .from('subscriptions')
        .select('*')
        .eq('websiteId', websiteId);

      if (error) {
        console.error('Error fetching subscriptions to clean:', error);
        return { message: 'Error fetching subscriptions', total: 0, cleaned: 0 };
      }

      subscriptionsToCheck = data || [];
      console.log(`Checking ${subscriptionsToCheck.length} subscriptions for website ID ${websiteId}`);
    } else {
      const { data, error } = await db
        .from('subscriptions')
        .select('*');

      if (error) {
        console.error('Error fetching all subscriptions to clean:', error);
        return { message: 'Error fetching subscriptions', total: 0, cleaned: 0 };
      }

      subscriptionsToCheck = data || [];
      console.log(`Checking all ${subscriptionsToCheck.length} subscriptions`);
    }

    if (subscriptionsToCheck.length === 0) {
      return { message: 'No subscriptions to check', total: 0, cleaned: 0 };
    }

    const { WebPush } = await import('node-webpush');
    const webpush = new WebPush({
      vapid: {
        subject: config.vapid.subject,
        publicKey: config.vapid.publicKey,
        privateKey: config.vapid.privateKey,
      }
    });

    // Silent notification payload
    const silentPayload = {
      title: 'Silent Notification',
      options: {
        silent: true,
        requireInteraction: false,
        timestamp: Date.now(),
        data: {
          type: 'validation',
          silent: true,
          timestamp: new Date().toISOString(),
          skipDisplay: true,
        },
      },
    };

    // Process validation pushes in controlled batches to avoid network saturation
    const CLEAN_BATCH_SIZE = 50;
    const results = [];
    for (let i = 0; i < subscriptionsToCheck.length; i += CLEAN_BATCH_SIZE) {
      const batch = subscriptionsToCheck.slice(i, i + CLEAN_BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map(async (subscription) => {
          try {
            // Parse keys if they're stringified (same as push-sender.worker.js)
            let parsedKeys = subscription.keys;
            let failsafe = 0;
            while (typeof parsedKeys === 'string' && failsafe < 3) {
              try { parsedKeys = JSON.parse(parsedKeys); } catch (e) { break; }
              failsafe++;
            }
            const cleanSub = { endpoint: subscription.endpoint, keys: parsedKeys || {} };

            // BUG-04 FIX: node-webpush uses generateRequest() + fetch(), NOT .notify()
            const { endpoint, init } = webpush.generateRequest(
              cleanSub, 
              JSON.stringify(silentPayload), 
              { TTL: 10 }
            );
            const res = await fetch(endpoint, init);
            
            if (res.ok) {
              return { subscription, valid: true };
            }
            
            return {
              subscription,
              valid: false,
              statusCode: res.status,
              error: `HTTP ${res.status}`,
            };
          } catch (error) {
            return {
              subscription,
              valid: false,
              statusCode: 500,
              error: error.message,
            };
          }
        })
      );
      results.push(...batchResults);
    }

    // Process results and remove invalid subscriptions
    let removed = 0;
    const invalidSubscriptions = [];

    results.forEach((result) => {
      if (result.status === 'fulfilled' && !result.value.valid) {
        const sub = result.value.subscription;
        if (result.value.statusCode === 404 || result.value.statusCode === 410) {
          invalidSubscriptions.push(sub.endpoint);
          console.log(`Identified invalid subscription: ${sub.endpoint}`);
          removed++;
        }
      }
    });

    // Batch delete invalid subscriptions
    if (invalidSubscriptions.length > 0) {
      for (const endpoint of invalidSubscriptions) {
        const { error } = await db
          .from('subscriptions')
          .delete()
          .eq('endpoint', endpoint);

        if (error) {
          console.error(`Error removing invalid subscription ${endpoint}:`, error);
        }
      }
    }

    return {
      message: `Checked ${subscriptionsToCheck.length} subscriptions, removed ${removed} invalid ones`,
      total: subscriptionsToCheck.length,
      cleaned: removed,
    };
  } catch (error) {
    console.error('Error in cleanExpiredSubscriptions:', error);
    return { message: 'Error cleaning subscriptions', error: error.message, total: 0, cleaned: 0 };
  }
}

module.exports = {
  sendNotifications,
  cleanExpiredSubscriptions,
  vapidDetails,
};
