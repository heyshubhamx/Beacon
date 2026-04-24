/**
 * Scheduler Service
 * 
 * Processes scheduled notifications that are due to be sent.
 * Called on an interval from the server entry point.
 */

const { db } = require('../../db');
// BUG-09 FIX: Route scheduled notifications through BullMQ instead of calling sendNotifications directly
const { enqueueNotificationJob } = require('../workers/pushWorker');

/**
 * Process all scheduled notifications whose scheduledFor time has passed.
 * @returns {Promise<Object>} - { processed: number } or { error: string }
 */
async function processScheduledNotifications() {
  console.log('Processing scheduled notifications...');

  try {
    const now = new Date();
    const nowIST = now.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    console.log(`Checking for scheduled notifications due before ${nowIST} IST`);

    const { data: scheduledNotifications, error } = await db
      .from('notifications')
      .select('*, data')
      .eq('status', 'scheduled')
      .lte('scheduledFor', now.toISOString());

    if (error) {
      console.error('Error fetching scheduled notifications:', error);
      return { error: 'Failed to fetch scheduled notifications' };
    }

    if (!scheduledNotifications || scheduledNotifications.length === 0) {
      console.log('No scheduled notifications to process');
      return { processed: 0 };
    }

    console.log(`Found ${scheduledNotifications.length} scheduled notifications to process`);

    // Log scheduled times
    scheduledNotifications.forEach((notification) => {
      const scheduledTime = new Date(notification.scheduledFor);
      const scheduledTimeIST = scheduledTime.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      console.log(`Processing notification scheduled for ${scheduledTimeIST} IST`);
    });

    let processedCount = 0;

    for (const notification of scheduledNotifications) {
      try {
        // Get all subscriptions for this website
        const { data: subscriptions, error: subError } = await db
          .from('subscriptions')
          .select('*')
          .eq('websiteId', notification.websiteId);

        if (subError) {
          console.error(`Error fetching subscriptions for website ${notification.websiteId}:`, subError);
          continue;
        }

        if (!subscriptions || subscriptions.length === 0) {
          console.log(`No subscriptions found for website ${notification.websiteId}`);
          await db
            .from('notifications')
            .update({ status: 'completed', notes: 'No active subscriptions' })
            .eq('id', notification.id);
          continue;
        }

        // Prepare notification payload
        const payload = {
          title: notification.title,
          options: {
            body: notification.body,
            icon: notification.icon,
            image: notification.image,
            data: notification.data || {},
          },
        };

        // Add URL if it exists
        if (notification.url) {
          if (!payload.options.data) payload.options.data = {};
          payload.options.data.url = notification.url;
        }

        // Preserve actions if they exist in the data
        if (notification.data && notification.data.actions) {
          payload.options.actions = notification.data.actions;
          console.log('Preserving action buttons for scheduled notification:',
            JSON.stringify(payload.options.actions, null, 2));
        }

        // Add notification ID for tracking
        payload.options.data.notificationId = notification.id;
        payload.options.data.websiteId = notification.websiteId;

        // Ensure all tracking properties are preserved
        if (notification.data) {
          if (notification.data.campaignId) {
            payload.options.data.campaignId = notification.data.campaignId;
          }
          if (notification.data.trackingParams) {
            payload.options.data.trackingParams = notification.data.trackingParams;
          }
        }

        console.log(`Notification payload for scheduled campaign: ${JSON.stringify(payload.options.data, null, 2)}`);

        // Campaign data to pass to sendNotifications
        const campaignData = {
          status: 'sent',
          scheduledFor: notification.scheduledFor,
        };

        if (notification.data && notification.data.campaign) {
          campaignData.name = notification.data.campaign.name;
          campaignData.description = notification.data.campaign.description;

          if (!payload.options.data.campaignId) {
            payload.options.data.campaignId = `scheduled_${notification.id}_${Date.now()}`;
            console.log(`Generated tracking campaign ID: ${payload.options.data.campaignId}`);
          }
        }

        // BUG-09 FIX: Enqueue via BullMQ instead of calling sendNotifications directly.
        // This gives us proper retry logic, concurrency control, and doesn't block the main thread timer.
        const job = await enqueueNotificationJob({
          websiteId: notification.websiteId,
          notificationPayload: payload,
          campaignData,
          deterministicId: `scheduled_${notification.id}`
        });

        console.log(`[Scheduler] Enqueued job ${job.id} for scheduled notification ${notification.id}`);

        // Update notification status to 'sent' (processing is now async via BullMQ)
        await db
          .from('notifications')
          .update({
            status: 'sent',
          })
          .eq('id', notification.id);

        processedCount++;
      } catch (err) {
        console.error(`Error processing notification ${notification.id}:`, err);
        await db
          .from('notifications')
          .update({
            notes: `Error processing: ${err.message}`,
            status: 'error',
          })
          .eq('id', notification.id);
      }
    }

    console.log(`Processed ${processedCount} scheduled notifications`);
    return { processed: processedCount };
  } catch (error) {
    console.error('Error in processScheduledNotifications:', error);
    return { error: error.message };
  }
}

module.exports = { processScheduledNotifications };
