/**
 * Browser / User-Agent Parser Utility
 * 
 * Extracts browser name, version, and OS from a User-Agent string.
 */

/**
 * Parse browser info from user agent string
 * @param {string} userAgent - The user agent string
 * @returns {{ browser: string, version: string, os: string }}
 */
function parseBrowserInfo(userAgent) {
  let browser = 'Unknown';
  let version = 'Unknown';
  let os = 'Unknown';

  // Extract OS info
  if (userAgent.includes('Windows')) {
    os = 'Windows';
  } else if (userAgent.includes('Mac OS')) {
    os = 'macOS';
  } else if (userAgent.includes('Android')) {
    os = 'Android';
  } else if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) {
    os = 'iOS';
  } else if (userAgent.includes('Linux')) {
    os = 'Linux';
  }

  // Extract browser info
  if (userAgent.includes('Chrome') && !userAgent.includes('Chromium')) {
    browser = 'Chrome';
    const match = userAgent.match(/Chrome\/(\d+)/);
    if (match) version = match[1];
  } else if (userAgent.includes('Firefox')) {
    browser = 'Firefox';
    const match = userAgent.match(/Firefox\/(\d+)/);
    if (match) version = match[1];
  } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    browser = 'Safari';
    const match = userAgent.match(/Version\/(\d+)/);
    if (match) version = match[1];
  } else if (userAgent.includes('Edge') || userAgent.includes('Edg/')) {
    browser = 'Edge';
    const match = userAgent.match(/Edg\/(\d+)/);
    if (match) version = match[1];
  } else if (userAgent.includes('MSIE') || userAgent.includes('Trident/')) {
    browser = 'Internet Explorer';
    const match = userAgent.match(/MSIE (\d+)/);
    if (match) version = match[1];
  }

  return { browser, version, os };
}

module.exports = { parseBrowserInfo };
