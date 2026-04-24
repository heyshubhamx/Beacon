/**
 * Subscription Authentication Utility
 * 
 * This file handles token-based authentication for subscription operations,
 * providing secure access to subscription endpoints without requiring full API key.
 */

const crypto = require('crypto');
const { db } = require('./db');
const { websites } = require('./db');

// Helper function to parse duration strings like '1h', '30m' into milliseconds
const ms = (str) => {
  const match = str.match(/^(\d+)([smhd])$/);
  if (!match) return parseInt(str, 10);
  
  const num = parseInt(match[1], 10);
  const unit = match[2];
  
  switch (unit) {
    case 's': return num * 1000;
    case 'm': return num * 60 * 1000;
    case 'h': return num * 60 * 60 * 1000;
    case 'd': return num * 24 * 60 * 60 * 1000;
    default: return num;
  }
};

/**
 * Generate a subscription token for a website
 * @param {string} websiteId - The website ID
 * @param {string} [expiresIn='1h'] - Token expiration time (e.g., '1h', '30m')
 * @returns {Promise<string>} The generated token
 */
const generateSubscriptionToken = async (websiteId, expiresIn = '1h') => {
  // Get the website to verify it exists and get its signing secret
  const website = await websites.getById(websiteId);
  
  if (!website) {
    throw new Error('Website not found');
  }
  
  // Use website's signing secret or generate a temporary one if not set
  const signingSecret = website.signingSecret || 
    crypto.createHash('sha256').update(websiteId).digest('hex');
  
  // Create token payload
  const payload = {
    websiteId,
    exp: Date.now() + ms(expiresIn),
    iat: Date.now()
  };
  
  // Convert payload to string
  const payloadStr = JSON.stringify(payload);
  
  // Base64 encode payload
  const payloadBase64 = Buffer.from(payloadStr).toString('base64');
  
  // Create signature
  const signature = crypto
    .createHmac('sha256', signingSecret)
    .update(payloadBase64)
    .digest('hex');
  
  // Create token
  const token = `${payloadBase64}.${signature}`;
  
  return token;
};

/**
 * Verify a subscription token
 * @param {string} token - The token to verify
 * @returns {Promise<Object>} The decoded payload if valid
 */
const verifyToken = async (token) => {
  // Split token into parts
  const parts = token.split('.');
  
  if (parts.length !== 2) {
    throw new Error('Invalid token format');
  }
  
  const [payloadBase64, signature] = parts;
  
  // Decode payload
  let payload;
  try {
    const payloadStr = Buffer.from(payloadBase64, 'base64').toString();
    payload = JSON.parse(payloadStr);
  } catch (e) {
    throw new Error('Invalid payload format');
  }
  
  // Check expiration
  if (payload.exp < Date.now()) {
    throw new Error('Token expired');
  }
  
  // Get website
  const website = await websites.getById(payload.websiteId);
  
  if (!website) {
    throw new Error('Website not found');
  }
  
  // Use website's signing secret or generate a temporary one if not set
  const signingSecret = website.signingSecret || 
    crypto.createHash('sha256').update(payload.websiteId).digest('hex');
  
  // Verify signature
  const expectedSignature = crypto
    .createHmac('sha256', signingSecret)
    .update(payloadBase64)
    .digest('hex');
  
  if (signature !== expectedSignature) {
    throw new Error('Invalid signature');
  }
  
  return payload;
};

/**
 * Middleware to verify subscription tokens
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const verifySubscriptionToken = async (req, res, next) => {
  // Get the token from the Authorization header
  const authHeader = req.headers.authorization;
  let token;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else {
    // For backward compatibility, also check the X-Subscription-Token header
    token = req.headers['x-subscription-token'];
  }
  
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Subscription token required'
    });
  }
  
  try {
    // Verify the token
    const decoded = await verifyToken(token);
    
    if (!decoded || !decoded.websiteId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Invalid subscription token'
      });
    }
    
    // Get the website
    const website = await websites.getById(decoded.websiteId);
    if (!website) {
      return res.status(404).json({
        success: false,
        error: 'Website not found'
      });
    }
    
    // Add the website to the request object
    req.website = website;
    next();
  } catch (error) {
    console.error('Subscription token verification error:', error);
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid subscription token'
    });
  }
};

module.exports = {
  generateSubscriptionToken,
  verifySubscriptionToken,
  verifyToken
}; 