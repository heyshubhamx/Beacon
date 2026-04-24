/**
 * BullMQ Setup and Worker Initialization
 * 
 * Sets up the Redis queues for notification processing.
 */

const { Queue, Worker } = require('bullmq');
const { Redis } = require('ioredis');
const config = require('../config');
const { sendNotifications } = require('../services/pushService');
const { db } = require('../../db');

// Redis connection setup
const connection = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: null, // Required by bullmq
});

connection.on('error', (err) => {
  console.error('Redis connection error:', err.message);
});

// Notifications Queue setup
const NOTIFICATION_QUEUE = 'push-notifications';

const notificationQueue = new Queue(NOTIFICATION_QUEUE, {
  connection,
  defaultJobOptions: {
    attempts: config.push.maxRetries || 3,
    backoff: {
      type: 'exponential',
      delay: config.push.retryBackoffMs || 1000,
    },
    removeOnComplete: true,
    removeOnFail: false, // Keep failed jobs for inspection
  },
});

/**
 * Enqueue a notification job
 * @param {Object} jobData - Job payload containing websiteId, campaignData, notification etc.
 */
async function enqueueNotificationJob(jobData) {
  // Use a deterministic job ID if available to prevent dupes (from NitroPing concept)
  const jobId = jobData.deterministicId || undefined;
  
  return notificationQueue.add(
    'sendPushNotification',
    jobData,
    { jobId }
  );
}

/**
 * Start the notification worker
 */
function startWorker() {
  console.log(`Starting BullMQ worker for ${NOTIFICATION_QUEUE}`);

  const worker = new Worker(NOTIFICATION_QUEUE, async (job) => {
    const { websiteId, notificationPayload, campaignData } = job.data;
    
    console.log(`[Worker] Processing job ${job.id} for website ${websiteId}`);
    
    const { data: siteSubscriptions, error } = await db
      .from('subscriptions')
      .select('*')
      .eq('websiteId', websiteId);

    if (error) {
      throw new Error(`Failed to fetch subscriptions: ${error.message}`);
    }

    if (!siteSubscriptions || siteSubscriptions.length === 0) {
      console.log(`[Worker] Job ${job.id}: No subscriptions found for website ${websiteId}`);
      return { status: 'skipped', reason: 'No subscriptions' };
    }

    // Call existing processing logic
    const result = await sendNotifications(siteSubscriptions, notificationPayload, campaignData);
    
    return result;
  }, {
    connection,
    concurrency: 5, // Process 5 jobs simultaneously
  });

  worker.on('completed', (job, result) => {
    console.log(`[Worker] Job ${job.id} completed successfully. Sent: ${result?.sent}, Failed: ${result?.failed}`);
    // BUG-08 FIX: Emit unconditionally so the frontend always gets real-time updates
    if (global.io) {
      global.io.emit('stats_update', { 
        type: 'campaign_processed', 
        websiteId: job.data.websiteId 
      });
    }
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job.id} failed:`, err.message);
  });
  
  return worker;
}

module.exports = {
  notificationQueue,
  enqueueNotificationJob,
  startWorker,
};
