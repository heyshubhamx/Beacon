/**
 * API Key Authentication Middleware
 * 
 * Validates the Bearer token against the master API key stored in Supabase settings.
 * Allows public endpoints to pass through without authentication.
 */

const { settings, websites } = require('../../db');

// Paths that do not require authentication
const PUBLIC_PATH_PATTERNS = [
  // Static pages
  /^\/$/,
  /^\/register$/,
  /^\/vapidPublicKey$/,
  /^\/health$/,
  
  // Website-specific public endpoints
  /^\/website\/[^/]+\/config$/,
  /^\/website\/[^/]+\/vapidPublicKey$/,
  /^\/website\/[^/]+\/subscription-token$/,
  /^\/website\/[^/]+\/prompt-event$/,
  /^\/website\/[^/]+\/sdk\.js$/,
  
  // CDN files
  /^\/cdn\/.*\.js$/,
  
  // Subscription operations (protected by subscription token separately)
  /^\/add-subscription$/,
  /^\/remove-subscription$/,
  /^\/update-subscription$/,
  
  // Tracking (protected by tracking tokens)
  /^\/track-notification-click$/,
  /^\/track-notification-delivery$/,
  /^\/report-notification-error$/,
  
  // Auth validation (handles its own password check internally)
  /^\/auth\/validate$/,
];

/**
 * Check if a path matches any public pattern
 * @param {string} path
 * @returns {boolean}
 */
function isPublicPath(path) {
  return PUBLIC_PATH_PATTERNS.some(pattern => pattern.test(path));
}

/**
 * Express middleware to authenticate API key for protected endpoints
 */
const authenticateApiKey = async (req, res, next) => {
  // Skip authentication for public paths
  if (isPublicPath(req.path)) {
    return next();
  }

  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/^Bearer (.+)$/);

  if (!match || !match[1]) {
    console.log(`Authentication failed: No API key provided for ${req.path}`);
    return res.status(401).json({ error: 'API key required' });
  }

  const apiKey = match[1];

  try {
    const validPassword = process.env.DASHBOARD_PASSWORD;

    if (apiKey !== validPassword) {
      console.log(`Authentication failed: Invalid password for ${req.path}`);
      return res.status(401).json({ error: 'Invalid password' });
    }

    // For website-specific endpoints, check the websiteId parameter
    if (req.path === '/notify-site') {
      const websiteId = req.body.websiteId || req.query.websiteId;
      if (!websiteId) {
        return res.status(400).json({ error: 'Website ID is required' });
      }

      const website = await websites.getById(websiteId);
      if (!website || !website.active) {
        return res.status(404).json({ error: 'Website not found or inactive' });
      }

      req.website = website;
    }

    next();
  } catch (error) {
    console.error('Error in authenticateApiKey:', error);
    return res.status(500).json({ error: 'Internal server error during authentication' });
  }
};

module.exports = { authenticateApiKey };
