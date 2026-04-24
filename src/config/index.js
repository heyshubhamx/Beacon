/**
 * Beacon Configuration
 * 
 * Centralizes all environment configuration and constants.
 */
require('dotenv').config();

const config = {
  // Server
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // VAPID
  vapid: {
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
    subject: process.env.VAPID_SUBJECT,
  },

  // Supabase
  db: {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_KEY,
  },

  // Redis (for BullMQ – Phase 1 addition)
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  },

  // Push sending
  push: {
    batchSize: parseInt(process.env.PUSH_BATCH_SIZE, 10) || 100,
    batchDelayMs: parseInt(process.env.PUSH_BATCH_DELAY_MS, 10) || 2000,
    ttl: parseInt(process.env.PUSH_TTL, 10) || 10000,
    maxRetries: parseInt(process.env.PUSH_MAX_RETRIES, 10) || 3,
    retryBackoffMs: parseInt(process.env.PUSH_RETRY_BACKOFF_MS, 10) || 1000,
  },

  // Rate limiting
  rateLimit: {
    trackingWindowMs: 15 * 60 * 1000, // 15 minutes
    trackingMaxRequests: 100,
  },
};

module.exports = config;
