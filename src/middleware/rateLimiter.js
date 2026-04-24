/**
 * Rate Limiting Middleware
 * 
 * Currently uses express-rate-limit (in-memory).
 * TODO Phase 1: Swap store to Redis via rate-limit-redis for distributed limiting.
 */

const rateLimit = require('express-rate-limit');
const config = require('../config');

/**
 * Rate limiter for notification tracking endpoints.
 * Keyed by IP + notificationId to prevent single-notification abuse.
 */
const trackingRateLimiter = rateLimit({
  windowMs: config.rateLimit.trackingWindowMs,
  max: config.rateLimit.trackingMaxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many tracking requests, please try again later' },
  keyGenerator: (req) => {
    const notificationId = req.body.notificationId || req.query.notificationId || 'unknown';
    return `${req.ip}-${notificationId}`;
  }
});

module.exports = { trackingRateLimiter };
