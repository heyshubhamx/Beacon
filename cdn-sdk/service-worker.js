// Import the main service worker from your Beacon instance
// Replace the URL below with your own Beacon deployment URL
self.importScripts('/cdn-sdk/push-service-worker.js');

// Version number to force updates
const SW_VERSION = '1.5.0';

// Get the current domain
const currentDomain = self.location.hostname;

// You can add custom handling here if needed
console.log(`Custom service worker initialized for ${currentDomain} (version ${SW_VERSION})`);

// IMPORTANT: We're completely removing the push event handler and notification click handler from this file
// to prevent duplicate handling. The imported service worker will handle all push events and notification clicks.
// The comprehensive version now includes click tracking functionality. 