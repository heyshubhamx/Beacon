/**
 * Settings Routes
 * 
 * API key management endpoints.
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { settings } = require('../../db');

// Regenerate master API key (protected by global authenticateApiKey middleware)
router.post('/regenerate-api-key', async (req, res) => {
  try {
    const newMasterKey = 'pp_master_' + crypto.randomBytes(16).toString('hex');
    await settings.setMasterApiKey(newMasterKey);

    res.json({
      success: true,
      message: 'Master API key regenerated successfully',
      apiKey: newMasterKey,
    });
  } catch (error) {
    console.error('Error in regenerate-api-key:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset API key (generates a new key unconditionally)
router.post('/reset-api-key', async (req, res) => {
  try {
    const newApiKey = 'pp_master_' + crypto.randomBytes(16).toString('hex');
    await settings.setMasterApiKey(newApiKey);

    console.log('API key reset successfully');

    res.json({
      success: true,
      apiKey: newApiKey,
      message: 'API key reset successfully',
    });
  } catch (error) {
    console.error('Error resetting API key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset API key',
      details: error.message,
    });
  }
});

module.exports = router;
