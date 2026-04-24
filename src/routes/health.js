/**
 * Health Check Routes
 */

const express = require('express');
const router = express.Router();
const { sql } = require('../../db');

// Simple health check
router.get('/health', async (req, res) => {
  try {
    const [result] = await sql`SELECT COUNT(*)::int as count FROM websites`;

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      db: 'connected (local postgres)',
      websitesCount: result.count,
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

// BUG-11 FIX: Dedicated auth validation endpoint that actually checks the password
router.post('/auth/validate', (req, res) => {
  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/^Bearer (.+)$/);

  if (!match || !match[1]) {
    return res.status(401).json({ valid: false, error: 'API key required' });
  }

  const apiKey = match[1];
  const validPassword = process.env.DASHBOARD_PASSWORD;

  if (apiKey === validPassword) {
    return res.json({ valid: true });
  }

  return res.status(401).json({ valid: false, error: 'Invalid password' });
});

module.exports = router;
