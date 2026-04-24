/**
 * Beacon Server Entry Point
 * 
 * Starts the Express server, initializes the master API key,
 * and starts the scheduled notification processor.
 */

const crypto = require('crypto');
const config = require('./config');
const app = require('./app');
const { settings } = require('../db');
const { processScheduledNotifications } = require('./services/schedulerService');
const { startWorker } = require('./workers/pushWorker');
const { Server } = require('socket.io');



// ─── Initialize Master API Key ───────────────────────────────
async function initializeMasterApiKey() {
  try {
    let masterKey = null;

    try {
      masterKey = await settings.getMasterApiKey();
      console.log('Using existing master API key');
    } catch (error) {
      // Key doesn't exist yet — generate a new one
      masterKey = 'pp_master_' + crypto.randomBytes(16).toString('hex');

      try {
        await settings.setMasterApiKey(masterKey);
        console.log('Generated new master API key:', masterKey);
      } catch (saveError) {
        console.error('Error saving master API key:', saveError);
      }
    }
  } catch (error) {
    console.error('Error in initializeMasterApiKey:', error);
  }
}

// ─── Start Server ────────────────────────────────────────────
const startServer = (port) => {
  const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);

    // Initialize API key
    initializeMasterApiKey();

    // Process scheduled notifications every minute
    setInterval(async () => {
      try {
        await processScheduledNotifications();
      } catch (error) {
        console.error('Error in scheduled notification processing:', error);
      }
    }, 60000);
    
    // Start BullMQ Worker
    try {
      startWorker();
    } catch (err) {
      console.error('Failed to start BullMQ worker:', err.message);
    }
    
    // Start Telegram Bot
    try {
      const { setupTelegramBot } = require('./bot/telegramBot');
      setupTelegramBot();
    } catch (err) {
      console.error('Failed to initialize Telegram Bot:', err.message);
    }

  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} is already in use, trying port ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });

  // Attach Socket.io
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ["GET", "POST", "OPTIONS", "PUT", "DELETE", "PATCH"]
    }
  });

  io.on('connection', (socket) => {
    // console.log('Client connected for real-time updates');
  });

  // Make io available globally
  global.io = io;

  return server;
};

startServer(config.port);
