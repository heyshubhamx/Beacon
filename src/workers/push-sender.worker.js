const { parentPort, workerData } = require('worker_threads');

// The workerData should contain vapid config so the worker can initialize its own WebPush instance
const { subscriptions, payload, options, config } = workerData;

let webpush;

/**
 * Executes a function with a retry/backoff strategy.
 * Useful for handling temporary rate limiting or 50x network errors.
 */
async function withRetries(fn, { attempts = 3, factor = 1000 } = {}) {
  let attempt = 1;
  while (attempt <= attempts) {
    try {
      const response = await fn();
      
      // If we got a 4xx client error (e.g., 404, 410 gone), do not retry.
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        return response;
      }
      
      // If 200/201, return success
      if (response.ok) {
        return response;
      }
      
      // 429 (Rate Limit) or 5xx server errors trigger retries
      if (attempt === attempts) {
        return response; // Return final response instead of throwing
      }
      
      // Calculate delay with some jitter
      const delay = factor * Math.pow(2, attempt - 1) + Math.random() * 500;
      await new Promise(res => setTimeout(res, delay));
      
      attempt++;
    } catch (error) {
      if (attempt === attempts) {
        throw error;
      }
      // Network failures (e.g. DNS, connection refused)
      const delay = factor * Math.pow(2, attempt - 1) + Math.random() * 500;
      await new Promise(res => setTimeout(res, delay));
      attempt++;
    }
  }
}

/**
 * Handle processing the bulk batch of notifications execution
 */
async function processBatch() {
  if (!webpush) {
    const { WebPush } = await import('node-webpush');
    webpush = new WebPush({
      vapid: {
        subject: config.vapid.subject,
        publicKey: config.vapid.publicKey,
        privateKey: config.vapid.privateKey,
      }
    });
  }

  const results = {
    sent: 0,
    failed: 0,
    removed: 0,
    successes: [],
    failures: [],
    expiredEndpoints: [],
  };

  /**
   * Process a single subscription push notification.
   */
  async function processSingle(subscription) {
    const endpointId = subscription.endpoint.substr(subscription.endpoint.length - 8);
    
    // Ensure keys object is cleanly formatted and parsed (Supabase JSON/JSONB can sometimes return strings, or double-encoded strings)
    let parsedKeys = subscription.keys;
    let failsafe = 0;
    while (typeof parsedKeys === 'string' && failsafe < 3) {
      try {
        parsedKeys = JSON.parse(parsedKeys);
      } catch (e) {
        console.error(`Failed to parse keys for endpoint ${endpointId}`);
        break;
      }
      failsafe++;
    }
    
    const cleanSubscription = {
      endpoint: subscription.endpoint,
      keys: parsedKeys || {}
    };
    
    try {
      // 1. Generate standard Web Push payload & headers using sanitized subscription
      const { endpoint, init } = webpush.generateRequest(
        cleanSubscription, 
        typeof payload === 'string' ? payload : JSON.stringify(payload), 
        options
      );

      // 2. Perform the request using Node native fetch with Retry Backoff wrapper
      const response = await withRetries(() => fetch(endpoint, init), {
        attempts: config.push?.maxRetries || 3,
        factor: config.push?.retryBackoffMs || 1000
      });

      // 3. Process the response
      if (response.ok) {
        results.sent++;
        results.successes.push(subscription.endpoint);
        return;
      }

      const status = response.status;
      results.failed++;

      // 404/410 means the user unsubscribed from their browser settings
      if (status === 404 || status === 410) {
        results.removed++;
        results.expiredEndpoints.push(subscription.endpoint);
      } else {
        const errorText = await response.text();
        results.failures.push({
          endpoint: subscription.endpoint,
          status,
          error: errorText,
        });
      }
    } catch (err) {
      results.failed++;
      results.failures.push({
        endpoint: subscription.endpoint,
        status: 500,
        error: err.message || 'Network Fetch Failure',
      });
    }
  }

  // Process fetch requests in controlled batches to prevent network saturation
  const CONCURRENCY = config.push?.workerConcurrency || 50;
  for (let i = 0; i < subscriptions.length; i += CONCURRENCY) {
    const batch = subscriptions.slice(i, i + CONCURRENCY);
    await Promise.allSettled(batch.map(sub => processSingle(sub)));
  }
  
  return results;
}

// Execute batch processing and report back to parent thread
processBatch()
  .then((results) => {
    parentPort.postMessage({ success: true, results });
  })
  .catch((err) => {
    parentPort.postMessage({ success: false, error: err.message });
  });
