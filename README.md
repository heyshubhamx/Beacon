<p align="center">
  <img src="https://img.shields.io/badge/Beacon-v2.0-6366f1?style=for-the-badge&logoColor=white" alt="Beacon v2.0" />
  <img src="https://img.shields.io/badge/Node.js-20+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/React-18+-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/PostgreSQL-15-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="MIT License" />
</p>

<h1 align="center">🔔 Beacon</h1>

<p align="center">
  <strong>Self-hosted web push notification platform — send millions of notifications from your own infrastructure.</strong>
</p>

<p align="center">
  No third-party limits · No per-message fees · Complete data ownership
</p>

---

## ✨ Features

- **🌐 Multi-Website Management** — Register unlimited domains and manage them all from one dashboard
- **⚡ Async Worker Architecture** — BullMQ + Redis background workers dispatch thousands of notifications without blocking the main thread
- **🔐 Direct P256DH Encryption** — VAPID handshakes directly with browser push services (FCM, Mozilla, etc.) — no third-party cloud wrappers
- **📊 Real-Time Analytics** — Track deliveries, clicks, subscriber growth, browser/OS/country breakdowns, and click-through rates in real time via WebSocket
- **📋 Campaign Manager** — Draft, schedule, and organize notifications into campaigns with detailed per-campaign metrics
- **🎨 Visual Prompt Editor** — Customize the browser permission prompt (slide, modal, or native) with live preview — colors, text, position, delays, and images
- **🤖 Telegram Bot** — Optionally create and send campaigns, view stats, and manage your platform directly from Telegram
- **🧩 Drop-in JavaScript SDK** — A single `<script>` tag handles service worker registration, permission prompts, subscription management, and offline event tracking
- **🐳 Fully Containerized** — One `docker compose up` spins up the Node server, PostgreSQL, and Redis
- **🔄 Auto-Resubscription** — SDK handles browser key rotations and re-subscribes users automatically
- **🛡️ Secure Tracking** — Signed JWT tokens per notification prevent metric spoofing on delivery, click, and error events
- **🔒 Dynamic CORS** — Registered website domains are automatically allowed — no manual CORS configuration needed

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Websites                         │
│   push-sdk.js → Service Worker → Browser Push Subscription     │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTPS
┌───────────────────────────▼─────────────────────────────────────┐
│                     Beacon Server (Node.js)                     │
│  ┌──────────┐  ┌──────────────┐  ┌───────────┐  ┌───────────┐  │
│  │ REST API │  │  Tracking    │  │  WebSocket │  │ Telegram  │  │
│  │ (Express)│  │  Endpoints   │  │  (live UI) │  │   Bot     │  │
│  └────┬─────┘  └──────┬───────┘  └─────┬─────┘  └─────┬─────┘  │
│       │               │               │               │        │
│  ┌────▼───────────────▼───────────────▼───────────────▼──────┐  │
│  │                    BullMQ Job Queue                        │  │
│  └────────────────────────┬──────────────────────────────────┘  │
│                           │                                     │
│  ┌────────────────────────▼──────────────────────────────────┐  │
│  │              Push Workers (batch sender)                   │  │
│  │         web-push → FCM / Mozilla Push Service             │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
        │                                           │
   ┌────▼─────┐                               ┌────▼─────┐
   │PostgreSQL│                               │  Redis   │
   │ (data)   │                               │ (queue)  │
   └──────────┘                               └──────────┘
```

---

## 🚀 Setup Guide

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) & Docker Compose
- [Node.js](https://nodejs.org/) (only needed to generate VAPID keys)

### 1. Clone & Create `.env`

```bash
git clone https://github.com/YOUR_USERNAME/Beacon.git
cd Beacon
cp .env.example .env
```

Now open `.env` and fill in each value following the steps below.

---

### 2. Generate VAPID Keys

VAPID keys are required for the Web Push protocol — they cryptographically identify your server to browser push services (FCM, Mozilla, etc.).

```bash
npx web-push generate-vapid-keys
```

This outputs something like:

```
Public Key:  BNbxGYNMhEIi_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Private Key: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Paste them into your `.env`:

```env
VAPID_PUBLIC_KEY="BNbxGYNMhEIi_xxxxxxx..."
VAPID_PRIVATE_KEY="xxxxxxxxxxxxxxxxxxx..."
VAPID_SUBJECT="mailto:your@email.com"
```

> `VAPID_SUBJECT` should be a `mailto:` link with your contact email — browser push services use it to contact you if there's an issue.

---

### 3. Set Database Password

Pick a strong password for PostgreSQL:

```env
POSTGRES_USER=push_admin
POSTGRES_PASSWORD=YOUR_STRONG_PASSWORD
POSTGRES_DB=beacon
```

> The database connection URL is built automatically from these values — no need to configure it separately.

---

### 4. Set Dashboard Password

This is the master password you'll use to log into the Beacon admin dashboard:

```env
DASHBOARD_PASSWORD="pick_a_strong_password"
```

---

### 5. Telegram Bot (Optional)

If you want to manage campaigns via Telegram:

1. Open Telegram and message [@BotFather](https://t.me/BotFather)
2. Send `/newbot` and follow the prompts to create a bot
3. BotFather gives you a token like `1234567890:ABCdefGhIjKlMnOpQrStUvWxYz`
4. To find your user ID, message [@userinfobot](https://t.me/userinfobot) — it replies with your numeric ID

```env
TELEGRAM_BOT_TOKEN="1234567890:ABCdefGhIjKlMnOpQrStUvWxYz"
TELEGRAM_AUTHORIZED_USER_ID="123456789"
```

> The `TELEGRAM_AUTHORIZED_USER_ID` restricts bot access to only your Telegram account.

---

### 6. Launch

```bash
docker compose up -d --build
```

The dashboard is live at **http://localhost:3010** 🎉

---

### 7. Add a Website

1. Log into the dashboard with your `DASHBOARD_PASSWORD`
2. Click **Add Website** and enter your domain
3. Copy the generated `<script>` tag into your site's HTML
4. Visitors will see the customizable permission prompt — subscribers start flowing in

---

## 🧩 SDK Integration

When you add a website in the dashboard, Beacon generates the integration code for you. It looks like this:

```html
<script src="https://your-beacon-server.com/cdn-sdk/push-sdk.js"></script>
<script>
  document.addEventListener('DOMContentLoaded', function() {
    Beacon.init({
      websiteId: 'YOUR_WEBSITE_ID',
      serviceWorkerPath: '/service-worker.js',
      autoRegister: true
    });
  });
</script>
```

You also need a `service-worker.js` at the root of your website:

```js
// Import the Beacon service worker
self.importScripts('https://your-beacon-server.com/cdn-sdk/push-service-worker.js');
```

> **Note:** The SDK auto-detects the API URL from the `<script>` tag source — no manual configuration needed.

### SDK Features
- Customizable permission prompt (slide, modal, or native)
- Automatic service worker registration
- Offline event queuing with retry
- Auto-resubscription on browser key rotation
- Signed JWT tokens for secure delivery/click tracking

---

## 📁 Project Structure

```
Beacon/
├── src/                        # Node.js backend
│   ├── routes/                 # REST API endpoints
│   │   ├── websites.js         # Website CRUD, config, stats
│   │   ├── notifications.js    # Notification dispatch engine
│   │   ├── campaigns.js        # Campaign management
│   │   ├── subscriptions.js    # Subscriber management
│   │   ├── tracking.js         # Delivery & click tracking
│   │   ├── dashboard.js        # Dashboard stats & analytics
│   │   ├── settings.js         # System settings
│   │   └── health.js           # Healthcheck endpoint
│   ├── workers/                # BullMQ background push senders
│   ├── bot/                    # Telegram bot integration
│   ├── middleware/             # Auth, CORS, rate limiting
│   ├── services/               # Scheduler service
│   ├── config/                 # Centralized env config
│   └── utils/                  # Helper utilities
├── frontend/                   # React + Vite dashboard
│   └── src/
│       ├── pages/              # Dashboard, Analytics, Campaigns, etc.
│       ├── components/         # UI components (shadcn/ui)
│       ├── contexts/           # API auth context
│       └── hooks/              # WebSocket hook
├── cdn-sdk/                    # Client-side SDK
│   ├── push-sdk.js             # Drop-in SDK with customizable prompts
│   └── push-service-worker.js  # Service worker (delivery/click tracking)
├── db.js                       # Database abstraction layer (PostgreSQL)
├── subscription-auth.js        # Token generation & verification
├── docker-compose.yml          # Full stack orchestration
├── Dockerfile                  # Multi-stage build
├── start-dev.sh                # Local development script
└── .env.example                # Configuration template
```

---

## ⚙️ Environment Variables Quick Reference

All variables are configured in `.env` — see the [Setup Guide](#-setup-guide) above for how to generate each one.

| Variable | Required | How to get it |
|---|---|---|
| `VAPID_PUBLIC_KEY` | ✅ | `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | ✅ | Same command as above |
| `VAPID_SUBJECT` | ✅ | Your `mailto:` email |
| `DASHBOARD_PASSWORD` | ✅ | Pick any strong password |
| `POSTGRES_PASSWORD` | ✅ | Pick any strong password for the database |
| `TELEGRAM_BOT_TOKEN` | ❌ | [@BotFather](https://t.me/BotFather) on Telegram |
| `TELEGRAM_AUTHORIZED_USER_ID` | ❌ | [@userinfobot](https://t.me/userinfobot) on Telegram |
| `REDIS_HOST` / `REDIS_PORT` | ❌ | Auto-configured by Docker Compose |
| `PUSH_BATCH_SIZE` | ❌ | Default: `100` — tune for your server |

## 🔌 API Reference

All endpoints are served from the Beacon server. Authentication is via `Authorization: Bearer <DASHBOARD_PASSWORD>`.

### Public SDK Endpoints
These are called by the client-side SDK and service worker — no auth required:

| Endpoint | Method | Description |
|---|---|---|
| `/website/:id/config` | GET | Fetch prompt settings (colors, text, position) |
| `/vapidPublicKey` | GET | Get the VAPID public key for push encryption |
| `/website/:id/subscription-token` | GET | Issue a short-lived token for subscription routes |
| `/add-subscription` | POST | Save a new browser push subscription |
| `/update-subscription` | POST | Update subscription on browser key rotation |
| `/remove-subscription` | POST | Remove subscription when user revokes permission |
| `/website/:id/prompt-event` | POST | Track prompt impressions, allows, and dismissals |
| `/track-notification-delivery` | POST | Track when notification arrives on device |
| `/track-notification-click` | POST | Track when user clicks the notification |
| `/report-notification-error` | POST | Report payload/rendering errors |
| `/health` | GET | Healthcheck for load balancers |

### Admin Dashboard Endpoints
Protected by `Authorization: Bearer <DASHBOARD_PASSWORD>`:

| Endpoint | Method | Description |
|---|---|---|
| `/auth/validate` | POST | Validate dashboard password |
| `/dashboard-stats` | GET | Top-level dashboard counters |
| `/analytics-data` | GET | Detailed charts (OS, browser, countries) |
| `/websites` | GET | List all registered websites |
| `/add-website` | POST | Register a new domain |
| `/website/:id` | GET | Fetch website details |
| `/website/:id` | DELETE | Delete website and all subscriptions |
| `/website/:id/stats` | GET | Granular website statistics |
| `/website/:id/toggle-status` | POST | Activate/deactivate a website |
| `/campaigns` | GET | List all campaigns |
| `/campaign/:id` | GET | Campaign details |
| `/notify-site` | POST | Send notification to a specific website |
| `/notify-all` | POST | Broadcast to all websites |
| `/notify-me` | POST | Send test notification to admin |
| `/subscriptions` | GET | List subscribers (paginated) |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Runtime** | Node.js 20+ |
| **API** | Express.js |
| **Database** | PostgreSQL 15 (via `postgres.js`) |
| **Queue** | BullMQ + Redis 7 |
| **Frontend** | React 18, Vite, Tailwind CSS, shadcn/ui |
| **Charts** | Recharts |
| **Real-time** | Socket.IO |
| **Push** | `web-push` (raw VAPID/P256DH encryption) |
| **Bot** | `node-telegram-bot-api` |
| **DevOps** | Docker, Docker Compose |

---

## 🧑‍💻 Development

Run the backend and frontend locally:

```bash
# Install dependencies
npm install
cd frontend && npm install && cd ..

# Start both servers
./start-dev.sh
```

- **Backend:** http://localhost:3000
- **Frontend:** http://localhost:5173

The frontend auto-detects the API from `window.location.origin` — no configuration needed.

---

## 📊 Database Schema

| Table | Purpose |
|---|---|
| `websites` | Registered domains, prompt config, aggregate stats (JSONB) |
| `subscriptions` | Browser push tokens (`endpoint`, `p256dh`, `auth`), device metadata |
| `notifications` | Sent campaigns with `sentCount`, `deliveredCount`, `clickCount`, `failedCount` |
| `settings` | System key-value storage (e.g., `masterApiKey`) |

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<p align="center">
  Built with ❤️ for the open-source community
</p>
