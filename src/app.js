/**
 * Express Application Setup
 * 
 * Configures middleware, static file serving, and mounts all routes.
 * This module exports the configured app — it does NOT start listening.
 */

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const config = require('./config');
const corsMiddleware = require('./middleware/cors');
const { authenticateApiKey } = require('./middleware/auth');
const mountRoutes = require('./routes');

// Ensure data directory exists
if (!fs.existsSync('./data')) {
  fs.mkdirSync('./data', { recursive: true });
}

const app = express();

// ─── Core Middleware ──────────────────────────────────────────
app.use(bodyParser.json());
// BUG-10 FIX: Removed blanket cors() — the custom corsMiddleware below handles allowed origins.
// BUG-12 FIX: Removed duplicate "Static files" comment.

// Static files
app.use(express.static(path.join(__dirname, '..', 'public')));
// Disable caching for SDK and Service Worker files so updates propagate instantly
app.use(['/cdn-sdk', '/beacon-service-worker.js'], (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

app.use('/cdn-sdk', express.static(path.join(__dirname, '..', 'cdn-sdk')));

// Legacy redirect for sdk-for-website
app.get('/sdk-for-website/:file', (req, res) => {
  res.redirect(`/cdn-sdk/${req.params.file}`);
});

// Serve unified React Frontend Build
app.use(express.static(path.join(__dirname, '..', 'frontend', 'dist')));

// Backward compatibility for old SDK paths
app.use('/push-sdk.js', express.static(path.join(__dirname, '..', 'cdn-sdk/push-sdk.js')));
app.use('/beacon-service-worker.js', express.static(path.join(__dirname, '..', 'cdn-sdk/push-service-worker.js')));

// Custom CORS handling (allowed origins list)
app.use(corsMiddleware);

// Request logger (skip health checks)
app.use((req, res, next) => {
  if (!req.path.includes('health')) {
    console.log(`${req.method} ${req.path}`);
  }
  next();
});

// Service worker unregister helper
app.get('/unregister-helper.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.send(`
    // Helper to unregister service workers
    async function unregisterServiceWorkers() {
      try {
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          
          if (registrations.length === 0) {
            console.log('No service workers to unregister');
            return { success: true, message: 'No service workers to unregister' };
          }
          
          await Promise.all(
            registrations.map(registration => {
              console.log('Unregistering service worker:', registration);
              return registration.unregister();
            })
          );
          
          console.log('All service workers unregistered');
          return { success: true, message: 'All service workers unregistered' };
        } else {
          console.log('Service workers not supported');
          return { success: false, message: 'Service workers not supported' };
        }
      } catch (error) {
        console.error('Error unregistering service workers:', error);
        return { success: false, error: error.message };
      }
    }
  `);
});

// Redirect register → login
app.get('/register', (req, res) => {
  res.redirect('/login');
});

// ─── Frontend Browser Interceptor ─────────────────────────────
// When users hit an API path via browser navigation (e.g. /websites), we serve the React app
app.use((req, res, next) => {
  if (req.method === 'GET' && req.headers.accept && req.headers.accept.includes('text/html')) {
    if (!req.path.startsWith('/cdn-sdk') && !req.path.startsWith('/sdk-for-website')) {
      return res.sendFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'));
    }
  }
  next();
});

// ─── Authentication Middleware ────────────────────────────────
app.use(authenticateApiKey);

// ─── API Routes ──────────────────────────────────────────────
mountRoutes(app);

module.exports = app;
