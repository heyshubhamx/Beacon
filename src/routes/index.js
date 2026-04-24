/**
 * Route Aggregator
 * 
 * Mounts all route modules onto the Express app.
 */

const healthRoutes = require('./health');
const websiteRoutes = require('./websites');
const subscriptionRoutes = require('./subscriptions');
const notificationRoutes = require('./notifications');
const trackingRoutes = require('./tracking');
const campaignRoutes = require('./campaigns');
const settingsRoutes = require('./settings');
const dashboardRoutes = require('./dashboard');

function mountRoutes(app) {
  app.use(healthRoutes);
  app.use(websiteRoutes);
  app.use(subscriptionRoutes);
  app.use(notificationRoutes);
  app.use(trackingRoutes);
  app.use(campaignRoutes);
  app.use(settingsRoutes);
  app.use(dashboardRoutes);
}

module.exports = mountRoutes;
