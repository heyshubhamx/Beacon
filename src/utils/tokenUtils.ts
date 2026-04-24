/**
 * Notification Tracking Token Utilities
 * 
 * Generates and verifies HMAC-signed tokens used for secure
 * notification click/delivery/error tracking.
 */

import * as crypto from 'crypto';

interface TokenPayload {
  notificationId?: string;
  websiteId: string;
  action?: string;
  exp: number;
  nonce: string;
}

/**
 * Generate a secure token for notification tracking
 */
export function generateNotificationToken(notificationId: string, websiteId: string, action: string): string {
  // Create a payload with the notification details and a short expiration time (24 hours)
  const payload: TokenPayload = {
    notificationId,
    websiteId,
    action,
    exp: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
    nonce: crypto.randomBytes(8).toString('hex') // Add randomness to prevent token reuse
  };

  // Convert payload to string and base64 encode it
  const payloadStr = JSON.stringify(payload);
  const payloadBase64 = Buffer.from(payloadStr).toString('base64');

  // Derive signing secret from websiteId (deterministic)
  const signingSecret = crypto.createHash('sha256').update(websiteId).digest('hex');

  // Create signature
  const signature = crypto
    .createHmac('sha256', signingSecret)
    .update(payloadBase64)
    .digest('hex');

  // Return the token as payload.signature
  return `${payloadBase64}.${signature}`;
}

/**
 * Verify a notification tracking token
 */
export function verifyNotificationToken(token: string): TokenPayload | null {
  try {
    // Split token into parts
    const parts = token.split('.');

    if (parts.length !== 2) {
      return null;
    }

    const [payloadBase64, signature] = parts;

    // Decode payload
    const payloadStr = Buffer.from(payloadBase64, 'base64').toString();
    const payload = JSON.parse(payloadStr);

    // Check if token has expired
    if (payload.exp < Date.now()) {
      return null;
    }

    // Derive signing secret from websiteId (deterministic)
    const signingSecret = crypto.createHash('sha256').update(payload.websiteId).digest('hex');

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', signingSecret)
      .update(payloadBase64)
      .digest('hex');

    if (signature !== expectedSignature) {
      return null;
    }

    return payload;
  } catch (error) {
    console.error('Error verifying notification token:', error);
    return null;
  }
}
