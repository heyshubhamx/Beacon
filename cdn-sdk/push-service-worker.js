/**
 * Beacon Service Worker
 * This is the main service worker file that handles push notifications
 */

const BEACON_VERSION = '1.5.0';
const CACHE_NAME = 'beacon-cache-v1-' + BEACON_VERSION;
const TRACKING_STORE = 'tracking-events';
const TRACKING_DB_NAME = 'beacon-tracking';
const TRACKING_DB_VERSION = 2; // Increment version to trigger upgrade

// Get base URL from service worker location or importScripts URL
const getBaseUrl = () => {
  try {
    // 1. Check if the API URL is defined in a global (if set by the loader)
    if (self.BEACON_API_URL) return self.BEACON_API_URL;
    
    // 2. Use self.location.origin
    if (self.location && self.location.origin && self.location.origin !== 'null') {
      return self.location.origin;
    }
    
    // 3. Fallback — should not normally reach here
    console.warn('[Beacon] Could not determine base URL, using empty string');
    return '';
  } catch (e) {
    console.error('[Beacon] Error determining base URL:', e);
    return '';
  }
};

// Initialize the base URL
const BASE_API_URL = getBaseUrl();
console.log('[Beacon] Using API URL:', BASE_API_URL);

// Open IndexedDB for tracking
function openTrackingDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(TRACKING_DB_NAME, TRACKING_DB_VERSION);
    
    request.onupgradeneeded = function(event) {
      const db = event.target.result;
      
      // Create an object store for tracking events if it doesn't exist
      if (!db.objectStoreNames.contains(TRACKING_STORE)) {
        // Use autoIncrement: true so we don't need to manually provide an 'id'
        const store = db.createObjectStore(TRACKING_STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('processed', 'processed', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        console.log('[Beacon] Created tracking object store with autoIncrement');
      } else {
        // Handle existing store - if we wanted to change schema we would do it here
        console.log('[Beacon] Tracking store already exists, version upgrade handled');
      }
    };
    
    request.onsuccess = function(event) {
      resolve(event.target.result);
    };
    
    request.onerror = function(event) {
      console.error('[Beacon] Error opening IndexedDB:', event.target.error);
      reject(event.target.error);
    };
  });
}

// Store tracking events for later sending when online
function storeForLaterTracking(type, data) {
  const trackingData = {
    id: Date.now() + '-' + Math.round(Math.random() * 1000000), // BUG FIX: Generate an ID so v1 schemas don't break
    type,
    data,
    timestamp: new Date().toISOString(),
    processed: false
  };
  
  openTrackingDB().then(db => {
    const transaction = db.transaction(TRACKING_STORE, 'readwrite');
    const store = transaction.objectStore(TRACKING_STORE);
    
    const request = store.add(trackingData);
    
    request.onsuccess = () => {
      console.log(`[Beacon] Stored ${type} event for later tracking`);
    };
    
    request.onerror = event => {
      console.error(`[Beacon] Error storing ${type} event:`, event.target.error);
    };
  }).catch(error => {
    console.error('[Beacon] Failed to store tracking data:', error);
  });
}

// BUG-18 FIX: Return a Promise so event.waitUntil() can track it properly
function processStoredTrackingEvents() {
  console.log('[Beacon] Processing stored tracking events');
  
  return openTrackingDB().then(async db => {
    try {
      const transaction = db.transaction(TRACKING_STORE, 'readwrite');
      const store = transaction.objectStore(TRACKING_STORE);
      
      // Collect all unprocessed events via cursor
      const unprocessedEvents = await new Promise((resolve, reject) => {
        const events = [];
        const request = store.openCursor();
        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            if (cursor.value.processed === false) {
              events.push(cursor.value);
            }
            cursor.continue();
          } else {
            resolve(events);
          }
        };
        request.onerror = (event) => reject(event.target.error);
      });
      
      if (unprocessedEvents.length === 0) {
        console.log('[Beacon] No stored events to process');
        return;
      }
      
      console.log(`[Beacon] Processing ${unprocessedEvents.length} stored tracking events`);
      
      const apiUrl = BASE_API_URL;
      
      for (const storedEvent of unprocessedEvents) {
        try {
          const { type, data, id } = storedEvent;
          let url, method, body;
          
          if (type === 'delivery') {
            url = `${apiUrl}/track-notification-delivery`;
            method = 'POST';
            body = JSON.stringify({
              notificationId: data.notificationId,
              websiteId: data.websiteId,
              timestamp: data.timestamp,
              isDelayed: true,
              token: data.token || ''
            });
          } else if (type === 'click') {
            url = `${apiUrl}/track-notification-click`;
            method = 'POST';
            body = JSON.stringify({
              notificationId: data.notificationId,
              websiteId: data.websiteId,
              action: data.action,
              timestamp: data.timestamp,
              isDelayed: true,
              token: data.token || ''
            });
          } else {
            console.log(`[Beacon] Unknown event type: ${type}`);
            continue;
          }
          
          const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body
          });
          
          if (response.ok) {
            console.log(`[Beacon] Successfully processed ${type} event ${id}`);
            const updateTx = db.transaction(TRACKING_STORE, 'readwrite');
            const updateStore = updateTx.objectStore(TRACKING_STORE);
            updateStore.put({ ...storedEvent, processed: true });
          } else {
            console.log(`[Beacon] Failed to process ${type} event ${id}: ${response.status}`);
          }
        } catch (error) {
          console.error(`[Beacon] Error processing event:`, error);
        }
      }
    } catch (error) {
      console.error('[Beacon] Error in transaction:', error);
    }
  }).catch(error => {
    console.error('[Beacon] Failed to process tracking data:', error);
  });
}

// Function to determine if a URL should be cached
function shouldCache(url) {
  // Don't cache chrome extension URLs
  if (url.startsWith('chrome-extension://')) {
    return false;
  }
  
  // Don't cache URLs with auth tokens or API keys
  if (url.includes('token=') || url.includes('key=') || url.includes('auth=')) {
    return false;
  }
  
  // Don't cache tracking endpoints
  if (url.includes('/track-notification-') || url.includes('/report-notification-')) {
    return false;
  }
  
  // Don't cache analytics endpoints
  if (url.includes('/analytics') || url.includes('/stats')) {
    return false;
  }
  
  // Cache static assets and resources
  return true;
}

// Install event - cache core files
self.addEventListener('install', function(event) {
  console.log('[Beacon] Service Worker installing, version:', BEACON_VERSION);
  
  // Skip waiting to ensure the newest version activates immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', function(event) {
  console.log('[Beacon] Service Worker activating, version:', BEACON_VERSION);
  
  // Claim all open clients to ensure the new service worker takes control
  event.waitUntil(self.clients.claim());
  
  // Clean up old caches
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            console.log('[Beacon] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  // Process any stored tracking events
  event.waitUntil(processStoredTrackingEvents());
});

// Fetch event - check URL before caching
self.addEventListener('fetch', function(event) {
  const request = event.request;
  
  // Skip non-GET requests and chrome-extension URLs
  if (request.method !== 'GET' || !shouldCache(request.url)) {
    return;
  }
  
  event.respondWith(
    caches.open(CACHE_NAME).then(function(cache) {
      // For API endpoints and tracking requests, use network-first strategy
      if (request.url.includes('/api/') || 
          request.url.includes('track-notification') || 
          request.url.includes('/website/')) {
        
        return fetch(request)
          .then(function(networkResponse) {
            // Cache the response if it's successful
            if (networkResponse.ok && shouldCache(request.url)) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(function(error) {
            console.log('[Beacon] Network request failed, falling back to cache:', error);
            return cache.match(request);
          });
      } 
      // For static assets, use cache-first strategy
      else {
        return cache.match(request).then(function(response) {
          if (response) {
            // Return cached response and update cache in the background
            const fetchPromise = fetch(request).then(function(networkResponse) {
              // BUG-14 FIX: Don't cache opaque responses (status 0) — they can permanently serve zero-byte content
              if (shouldCache(request.url) && networkResponse.status !== 0 && networkResponse.type !== 'opaque') {
                cache.put(request, networkResponse.clone());
              }
              return networkResponse;
            }).catch(error => {
              console.log('[Beacon] Background fetch failed:', error);
            });
            
            // Don't wait for the background fetch
            setTimeout(() => fetchPromise, 0);
            
            return response;
          }
          
          // No cached response, fetch from network
          return fetch(request).then(function(networkResponse) {
            // BUG-14 FIX: Don't cache opaque responses
            if (shouldCache(request.url) && networkResponse.status !== 0 && networkResponse.type !== 'opaque') {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          });
        });
      }
    }).catch(function(error) {
      console.error('[Beacon] Fetch error:', error);
      return fetch(request);
    })
  );
});

// Push event - handle incoming push notifications
self.addEventListener('push', function(event) {
  console.log('[Beacon] Push event received', event);
  
  let notificationData = {
    title: 'New Notification',
    options: {
      body: 'You have a new notification',
      icon: '/icon.png',
      badge: '/badge.png',
      data: {
        timestamp: new Date().toISOString()
      }
    }
  };
  
  // Parse data if available
  if (event.data) {
    try {
      // Try different methods to extract data, as Firefox and Chrome handle this differently
      let jsonData;
      try {
        jsonData = event.data.json();
        console.log('[Beacon] Push data from json():', jsonData);
      } catch (jsonError) {
        // Firefox sometimes requires using text() instead of json()
        const text = event.data.text();
        console.log('[Beacon] Push data from text():', text);
        jsonData = JSON.parse(text);
      }
      
      const data = jsonData;
      
      // Check if data has the expected format
      if (data.title) {
        notificationData = data;
      } else if (data.notification) {
        notificationData = data.notification;
      }
      
      // Add a timestamp and tag if not provided
      if (!notificationData.options) {
        notificationData.options = {};
      }
      
      if (!notificationData.options.data) {
        notificationData.options.data = {};
      }
      
      // Preserve actions if they exist in the original data
      // This ensures action buttons work correctly on all platforms
      if (data.options && data.options.actions) {
        notificationData.options.actions = data.options.actions;
      }
      
      if (!notificationData.options.timestamp) {
        notificationData.options.timestamp = Date.now();
      }
      
      if (!notificationData.options.tag) {
        notificationData.options.tag = 'beacon-' + notificationData.options.timestamp;
      }
      
      // Ensure data.timestamp exists for click tracking
      if (!notificationData.options.data.timestamp) {
        notificationData.options.data.timestamp = new Date().toISOString();
      }
      
      // IMPORTANT: Check if this is a silent notification (for validation/cleanup)
      // If silent is true, don't show a notification to the user
      if (notificationData.options.silent === true || 
          (notificationData.options.data && notificationData.options.data.type === 'validation') ||
          (notificationData.options.data && notificationData.options.data.silent === true) ||
          (notificationData.options.data && notificationData.options.data.skipDisplay === true)) {
        console.log('[Beacon] Silent notification received, skipping display');
        return;
      }
    } catch (error) {
      console.error('[Beacon] Error parsing push data:', error);
    }
  } else {
    console.log('[Beacon] No data in push event');
  }
  
  console.log('[Beacon] Final notification options:', JSON.stringify(notificationData.options));
  
  // Show the notification with improved error handling
  event.waitUntil(
    (async () => {
      try {
        console.log('[Beacon] Attempting to show notification:', notificationData.title);
        // Try to show the notification
        await self.registration.showNotification(notificationData.title, notificationData.options);
        console.log('[Beacon] Notification display promise resolved');
        
        // Report delivery success if we have notification ID and website ID
        const data = (notificationData.options && notificationData.options.data) ? notificationData.options.data : {};
        if (data.notificationId && data.websiteId) {
          console.log('[Beacon] Tracking delivery for:', data.notificationId);
          // Store delivery info in IndexedDB for reliability
          try {
            // Mark this notification as delivered in the options data for future reference
            if (notificationData.options && notificationData.options.data) {
              notificationData.options.data.deliveryTracked = true;
              notificationData.options.data.deliveryTime = new Date().toISOString();
            }
            
            // Use the configured API URL for tracking
            const trackingApiUrl = BASE_API_URL || '';
            
            // Function to track delivery with retry capability
            const trackDelivery = async (retryCount = 0) => {
              try {
                const response = await fetch(`${trackingApiUrl}/track-notification-delivery`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    notificationId: data.notificationId,
                    websiteId: data.websiteId,
                    timestamp: notificationData.options.data.deliveryTime,
                    deviceType: self.navigator.userAgent,
                    isBackground: true, // Service workers always run in the background
                    token: data.deliveryToken // Include the secure token for verification
                  })
                });
                
                if (response.ok) {
                  console.log('[Beacon] Delivery successfully tracked');
                  return true;
                } else if (retryCount < 2) {
                  // Retry up to 2 times with exponential backoff
                  console.log(`[Beacon] Delivery tracking failed, retrying (${retryCount + 1}/2)...`);
                  await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
                  return trackDelivery(retryCount + 1);
                } else {
                  throw new Error(`Server responded with ${response.status}`);
                }
              } catch (error) {
                console.log('[Beacon] Delivery tracking error:', error);
                
                if (retryCount < 2) {
                  // Retry up to 2 times with exponential backoff
                  console.log(`[Beacon] Delivery tracking failed, retrying (${retryCount + 1}/2)...`);
                  await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
                  return trackDelivery(retryCount + 1);
                }
                
                        // Store for later tracking
        storeForLaterTracking('delivery', {
          notificationId: data.notificationId,
          websiteId: data.websiteId,
          timestamp: notificationData.options.data.deliveryTime,
          token: data.deliveryToken // Include token for later verification
        });
                return false;
              }
            };
            
            // Start tracking without waiting for it to complete
            trackDelivery().catch(err => console.log('[Beacon] Final delivery tracking error:', err));
            
          } catch (trackingError) {
            // Ignore tracking errors - delivery tracking is not critical
            console.log('[Beacon] Delivery tracking error (non-critical):', trackingError);
            
            // Store for later tracking
            storeForLaterTracking('delivery', {
              notificationId: data.notificationId,
              websiteId: data.websiteId,
              timestamp: new Date().toISOString(),
              token: data.deliveryToken // Include token for later verification
            });
          }
        }
      } catch (error) {
        console.error('[Beacon] Error showing notification:', error);
        
        // Try to report the error to the server if we have notification ID and website ID
        const data = notificationData.options.data || {};
        if (data.notificationId && data.websiteId) {
          const apiUrl = BASE_API_URL;
          
          try {
            // Report error (don't wait for response)
            fetch(`${apiUrl}/report-notification-error?websiteId=${encodeURIComponent(data.websiteId)}&notificationId=${encodeURIComponent(data.notificationId)}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                notificationId: data.notificationId,
                websiteId: data.websiteId,
                error: error.message || 'Unknown error',
                timestamp: new Date().toISOString(),
                token: data.errorToken || '' // Include the secure token for verification
              })
            }).catch(reportError => {
              console.log('[Beacon] Error reporting failed (non-critical):', reportError);
            });
          } catch (reportError) {
            // Ignore reporting errors
            console.log('[Beacon] Error reporting failed (non-critical):', reportError);
          }
        }
      }
    })()
  );
});

// Notification click event - handle notification clicks with tracking
self.addEventListener('notificationclick', function(event) {
  console.log('[Beacon] Notification click received', event.notification.tag);
  
  // Close the notification
  event.notification.close();
  
  // Get notification data
  const notification = event.notification;
  const data = notification.data || {};
  const notificationId = data.notificationId;
  const websiteId = data.websiteId;
  const url = data.url;
  const timestamp = new Date().toISOString();
  
  // Handle action button clicks
  const actionId = event.action || 'default';
  console.log(`[Beacon] Action clicked: ${actionId}`);
  
  // Determine URL to open based on action
  let targetUrl = url;
  if (actionId !== 'default' && notification.actions) {
    // Find the clicked action from available actions
    const clickedAction = notification.actions.find(action => action.action === actionId);
    if (clickedAction && clickedAction.url) {
      targetUrl = clickedAction.url;
      console.log(`[Beacon] Using action URL: ${targetUrl}`);
    }
  }
  
  // Track the click if we have a notification ID
  if (notificationId && websiteId) {
    console.log(`[Beacon] Tracking click for notification ${notificationId} on website ${websiteId}, action: ${actionId}`);
    
    // Use the configured API URL for tracking
    const trackingApiUrl = BASE_API_URL;
    
    // Function to track clicks with retry capability
    const trackClick = async (retryCount = 0) => {
      try {
        const response = await fetch(`${trackingApiUrl}/track-notification-click`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            notificationId,
            websiteId,
            action: actionId,
            timestamp,
            deviceType: self.navigator.userAgent,
            token: data.clickToken // Include the secure token for verification
          })
        });
        
        if (response.ok) {
          console.log('[Beacon] Click successfully tracked');
          return true;
        } else if (retryCount < 2) {
          // Retry up to 2 times with exponential backoff
          console.log(`[Beacon] Click tracking failed, retrying (${retryCount + 1}/2)...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
          return trackClick(retryCount + 1);
        } else {
          throw new Error(`Server responded with ${response.status}`);
        }
      } catch (error) {
        console.error('[Beacon] Error tracking notification click:', error);
        
        if (retryCount < 2) {
          // Retry up to 2 times with exponential backoff
          console.log(`[Beacon] Click tracking failed, retrying (${retryCount + 1}/2)...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
          return trackClick(retryCount + 1);
        }
        
        // If all retries fail, try fallback GET request
        try {
          const fallbackResponse = await fetch(`${trackingApiUrl}/track-notification-click?websiteId=${encodeURIComponent(websiteId)}&notificationId=${encodeURIComponent(notificationId)}&action=${encodeURIComponent(actionId)}&token=${encodeURIComponent(data.clickToken || '')}`, {
            method: 'GET',
            credentials: 'omit'
          });
          
          console.log('[Beacon] Fallback GET request status:', fallbackResponse.status);
          
          if (fallbackResponse.ok) {
            return true;
          }
        } catch (fallbackError) {
          console.error('[Beacon] Fallback request also failed:', fallbackError);
        }
        
        // Store for later tracking when online
        storeForLaterTracking('click', {
          notificationId,
          websiteId,
          action: actionId,
          timestamp,
          token: data.clickToken // Include token for later verification
        });
        
        return false;
      }
    };
    
    // Start the tracking process
    const trackingPromise = trackClick();
    
    // Open URL if provided
    if (targetUrl) {
      event.waitUntil(
        Promise.all([
          trackingPromise,
          clients.openWindow(targetUrl)
        ])
      );
    } else {
      // Try to focus an existing window
      event.waitUntil(
        Promise.all([
          trackingPromise,
          clients.matchAll({type: 'window'})
            .then(clientList => {
              for (const client of clientList) {
                if ('focus' in client) {
                  return client.focus();
                }
              }
              if (clients.openWindow) {
                return clients.openWindow('/');
              }
            })
        ])
      );
    }
  } else if (targetUrl) {
    // Handle legacy notifications without tracking data
    event.waitUntil(
      clients.openWindow(targetUrl)
    );
  } else {
    // Try to focus an existing window for notifications without URL
    event.waitUntil(
      clients.matchAll({type: 'window'})
        .then(clientList => {
          for (const client of clientList) {
            if ('focus' in client) {
              return client.focus();
            }
          }
          if (clients.openWindow) {
            return clients.openWindow('/');
          }
        })
    );
  }
});

// Notification close event
self.addEventListener('notificationclose', function(event) {
  console.log('[Beacon] Notification closed:', event.notification.tag);
});

// Push subscription change event
self.addEventListener('pushsubscriptionchange', function(event) {
  console.log('[Beacon] Push subscription changed');
  
  // BUG-16 FIX: Guard against null oldSubscription (full removal, not rotation)
  if (!event.oldSubscription) {
    console.warn('[Beacon] Old subscription is null — subscription was fully removed, not rotated');
    return;
  }
  
  // Get the current website ID if available
  const getWebsiteId = () => {
    return new Promise((resolve) => {
      self.clients.matchAll().then(clients => {
        if (clients.length > 0) {
          clients[0].postMessage({ type: 'GET_WEBSITE_ID' });
          
          // Listen for response
          self.addEventListener('message', function onMessage(msgEvent) {
            if (msgEvent.data && msgEvent.data.type === 'WEBSITE_ID' && msgEvent.data.websiteId) {
              self.removeEventListener('message', onMessage);
              resolve(msgEvent.data.websiteId);
            }
          });
          
          // Set a timeout in case no response
          setTimeout(() => resolve(null), 500);
        } else {
          resolve(null);
        }
      });
    });
  };
  
  event.waitUntil(
    Promise.all([
      self.registration.pushManager.subscribe(event.oldSubscription.options),
      getWebsiteId()
    ])
    .then(([subscription, websiteId]) => {
      const apiUrl = BASE_API_URL;
      
      // Prepare update data
      const updateData = {
        oldSubscription: event.oldSubscription,
        subscription: subscription
      };
      
      // Add website ID if available
      if (websiteId) {
        updateData.websiteId = websiteId;
      }
      
      // BUG-15 FIX: First fetch a subscription token, then send the update with auth
      const tokenPromise = websiteId 
        ? fetch(`${apiUrl}/website/${websiteId}/subscription-token`)
            .then(r => r.ok ? r.json() : null)
            .then(d => d ? d.token : null)
            .catch(() => null)
        : Promise.resolve(null);
      
      return tokenPromise.then(token => {
        const headers = { 'Content-Type': 'application/json' };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        return fetch(`${apiUrl}/update-subscription`, {
          method: 'POST',
          headers,
          body: JSON.stringify(updateData)
        });
      });
    })
    .catch(error => {
      console.error('[Beacon] Subscription update failed:', error);
    })
  );
});

// Online event - process stored tracking events
self.addEventListener('online', function() {
  console.log('[Beacon] Online event detected, processing stored tracking events');
  processStoredTrackingEvents();
});

// Receive messages from clients
self.addEventListener('message', function(event) {
  console.log('[Beacon] Message received in service worker:', event.data);
  
  // Handle different message types
  if (event.data && event.data.type) {
    switch (event.data.type) {
      case 'SKIP_WAITING':
        self.skipWaiting();
        break;
        
      case 'VERSION':
        event.ports[0].postMessage({
          version: BEACON_VERSION
        });
        break;
        
      case 'PROCESS_TRACKING':
        processStoredTrackingEvents();
        break;
    }
  }
});

console.log('[Beacon] Service Worker loaded successfully with enhanced tracking support');