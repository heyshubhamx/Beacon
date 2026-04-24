/**
 * General-purpose helper utilities
 */

const { websites } = require('../../db');

/**
 * Generate a random 9-character website ID (A-Z, 0-9)
 * @returns {string}
 */
function generateWebsiteId() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 9; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

/**
 * Lookup the domain for a website ID
 * @param {string} websiteId
 * @returns {Promise<string>}
 */
async function getWebsiteUrl(websiteId) {
  try {
    const website = await websites.getById(websiteId);
    return website ? website.domain : 'unknown';
  } catch (error) {
    console.error('Error in getWebsiteUrl:', error);
    return 'unknown';
  }
}

module.exports = { generateWebsiteId, getWebsiteUrl };
