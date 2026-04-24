/**
 * CORS Middleware Configuration
 * 
 * Dynamically allows origins based on registered website domains in the DB.
 */

const { websites } = require('../../db');

// Cache registered domains for 60 seconds to avoid hitting the DB on every request
let cachedOrigins = [];
let cacheTimestamp = 0;
const CACHE_TTL = 60 * 1000; // 60 seconds

async function getRegisteredOrigins() {
  const now = Date.now();
  if (now - cacheTimestamp < CACHE_TTL && cachedOrigins.length > 0) {
    return cachedOrigins;
  }

  try {
    const allWebsites = await websites.getAll();
    cachedOrigins = allWebsites
      .filter(w => w.domain)
      .flatMap(w => [
        `https://${w.domain}`,
        `http://${w.domain}`,
      ]);
    cacheTimestamp = now;
  } catch (error) {
    console.error('CORS: Error fetching website domains:', error);
    // Keep using the old cache if DB fails
  }

  return cachedOrigins;
}

// Always-allowed origins (localhost for dev)
const LOCAL_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
];

const publicPaths = [
  '/track-notification',
  '/website/',
  '/prompt-event',
  '/vapidPublicKey',
  '/add-subscription',
  '/update-subscription',
  '/remove-subscription'
];

/**
 * Custom CORS middleware that dynamically allows registered website domains
 */
async function corsMiddleware(req, res, next) {
  const origin = req.headers.origin;
  const isPublicEndpoint = publicPaths.some(p => req.path.includes(p));

  if (isPublicEndpoint || !origin) {
    // Public SDK endpoints — allow the requesting origin
    res.header('Access-Control-Allow-Origin', origin || '*');
  } else {
    // Check against registered domains + localhost
    const registeredOrigins = await getRegisteredOrigins();
    const allAllowed = [...LOCAL_ORIGINS, ...registeredOrigins];

    if (allAllowed.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
    }
  }

  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key, X-Subscription-Token');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  next();
}

module.exports = corsMiddleware;
