# Deployment Guide: Fibbage Clone on biffage.com

This guide covers deploying the Fibbage trivia game to production on your domain **biffage.com**.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Production Code Changes](#production-code-changes)
3. [Deployment Options](#deployment-options)
   - [Option A: VPS (Recommended)](#option-a-vps-recommended)
   - [Option B: Railway/Render (Easiest)](#option-b-railwayrender-easiest)
4. [Domain & SSL Configuration](#domain--ssl-configuration)
5. [Environment Variables](#environment-variables)
6. [Post-Deployment Checklist](#post-deployment-checklist)

---

## Prerequisites

- Domain: **biffage.com** with DNS access
- Gemini API Key from [Google AI Studio](https://aistudio.google.com/apikey)
- Git repository for your code (GitHub, GitLab, etc.)

---

## Production Code Changes

Before deploying, make the following changes to support production URLs:

### 1. Update Client Socket Connection

The client needs to connect to your production server. Update `client/src/context/SocketContext.tsx`:

```typescript
import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const SocketContext = createContext<Socket | null>(null);

export const useSocket = () => {
  return useContext(SocketContext);
};

// Get server URL from environment or use current origin
const getServerUrl = () => {
  // In production, use the same origin (when served from same domain)
  // Or specify explicitly via environment variable
  if (import.meta.env.VITE_SERVER_URL) {
    return import.meta.env.VITE_SERVER_URL;
  }
  // Default: same origin for production, localhost for dev
  if (import.meta.env.DEV) {
    return 'http://localhost:3001';
  }
  return window.location.origin;
};

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const serverUrl = getServerUrl();
    console.log('Connecting to server:', serverUrl);
    const newSocket = io(serverUrl);
    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};
```

### 2. Update Server for Production

Update `server/index.js` to serve the built client and handle production CORS:

```javascript
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require("socket.io");
const cors = require('cors');
require('dotenv').config({ path: '../.env' });

const RoomManager = require('./RoomManager');

const app = express();
const server = http.createServer(app);

// Production CORS - allow your domain
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:3001'];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"]
  }
});

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// Serve static files from the built client
const clientBuildPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientBuildPath));

const roomManager = new RoomManager(io);

// Socket.IO event handlers...
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  // ... rest of your socket handlers
});

// Catch-all: serve index.html for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(clientBuildPath, 'index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
```

### 3. Create Production Environment File

Create `.env.production` in the project root:

```env
# Server
PORT=3001
NODE_ENV=production
ALLOWED_ORIGINS=https://biffage.com,https://www.biffage.com

# Gemini AI
GEMINI_API_KEY=your_gemini_api_key_here
```

---

## Deployment Options

### Option A: VPS (Recommended)

Best for: Full control, WebSocket support, cost-effective for 24/7 uptime.

**Recommended Providers:**
- [DigitalOcean](https://digitalocean.com) - $6/mo droplet
- [Vultr](https://vultr.com) - $6/mo
- [Linode](https://linode.com) - $5/mo
- [Hetzner](https://hetzner.com) - €4/mo (EU)

#### Step 1: Create VPS

1. Create an Ubuntu 22.04 LTS server (1GB RAM minimum)
2. Note your server IP address
3. SSH into your server: `ssh root@YOUR_SERVER_IP`

#### Step 2: Initial Server Setup

```bash
# Update system
apt update && apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install PM2 (process manager)
npm install -g pm2

# Install Nginx (reverse proxy)
apt install -y nginx

# Install Certbot for SSL
apt install -y certbot python3-certbot-nginx

# Create app user
adduser --disabled-password --gecos "" appuser
```

#### Step 3: Deploy Application

```bash
# Switch to app user
su - appuser

# Clone your repository
git clone https://github.com/YOUR_USERNAME/mcp_test.git
cd mcp_test

# Install dependencies
npm install
cd server && npm install
cd ../client && npm install

# Build the client
npm run build

# Create production .env
cd ..
nano .env
# Paste your production environment variables

# Start with PM2
cd server
pm2 start index.js --name fibbage
pm2 save
pm2 startup
# Run the command PM2 outputs (as root)
```

#### Step 4: Configure Nginx

Create `/etc/nginx/sites-available/biffage.com`:

```nginx
server {
    listen 80;
    server_name biffage.com www.biffage.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # WebSocket timeout settings
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
```

Enable the site:

```bash
ln -s /etc/nginx/sites-available/biffage.com /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

#### Step 5: SSL Certificate

```bash
certbot --nginx -d biffage.com -d www.biffage.com
```

Follow the prompts. Certbot will auto-renew certificates.

---

### Option B: Railway/Render (Easiest)

Best for: Quick deployment, managed infrastructure, auto-scaling.

#### Railway Deployment

1. Push your code to GitHub
2. Go to [railway.app](https://railway.app) and sign in with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repository
5. Railway will auto-detect Node.js

**Configure the build:**

In Railway dashboard, add these settings:

```
Root Directory: server
Build Command: cd ../client && npm install && npm run build && cd ../server && npm install
Start Command: node index.js
```

**Add Environment Variables:**
- `PORT` = `3001` (Railway will override with its own)
- `NODE_ENV` = `production`
- `GEMINI_API_KEY` = your key
- `ALLOWED_ORIGINS` = `https://biffage.com,https://www.biffage.com`

**Custom Domain:**
1. Go to Settings → Domains
2. Add `biffage.com`
3. Copy the CNAME record to your DNS

#### Render Deployment

1. Push to GitHub
2. Go to [render.com](https://render.com)
3. New → Web Service → Connect your repo

**Settings:**
```
Root Directory: server
Build Command: cd ../client && npm install && npm run build && cd ../server && npm install
Start Command: node index.js
```

Add the same environment variables as Railway.

---

## Domain & SSL Configuration

### DNS Settings for biffage.com

#### For VPS Deployment:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | @ | YOUR_SERVER_IP | 300 |
| A | www | YOUR_SERVER_IP | 300 |

#### For Railway/Render:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| CNAME | @ | your-app.railway.app | 300 |
| CNAME | www | your-app.railway.app | 300 |

> Note: Some DNS providers don't allow CNAME on root (@). Use their ALIAS/ANAME feature or point to Railway's IP.

---

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Server port | `3001` |
| `NODE_ENV` | Environment | `production` |
| `GEMINI_API_KEY` | Google AI API key | `AIza...` |
| `ALLOWED_ORIGINS` | CORS whitelist | `https://biffage.com,https://www.biffage.com` |

---

## Post-Deployment Checklist

### ✅ Before Going Live

- [ ] Test WebSocket connection (Socket.IO)
- [ ] Verify Gemini AI audio works
- [ ] Test on mobile devices (player view)
- [ ] Test room creation and joining
- [ ] Check SSL certificate is valid (`https://`)
- [ ] Verify CORS allows your domain

### ✅ Monitoring & Maintenance

#### For VPS:

```bash
# View logs
pm2 logs fibbage

# Monitor resources
pm2 monit

# Restart after updates
cd ~/mcp_test
git pull
cd client && npm run build
pm2 restart fibbage
```

#### For Railway/Render:

- Logs available in dashboard
- Auto-deploys on git push

### ✅ Performance Tips

1. **Enable Compression:**
   Add to `server/index.js`:
   ```javascript
   const compression = require('compression');
   app.use(compression());
   ```
   And install: `npm install compression`

2. **Rate Limiting:**
   Consider adding rate limiting for production:
   ```javascript
   const rateLimit = require('express-rate-limit');
   app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
   ```

---

## Quick Reference

### Development
```bash
# Terminal 1: Server
cd server && npm start

# Terminal 2: Client
cd client && npm run dev
```

### Production Build
```bash
cd client && npm run build
```

### URLs

| Environment | Host View | Player View |
|-------------|-----------|-------------|
| Development | http://localhost:5173/host | http://localhost:5173/play |
| Production | https://biffage.com/host | https://biffage.com/play |

---

## Troubleshooting

### WebSocket Connection Failed

1. Check Nginx config includes WebSocket headers
2. Verify CORS origins include your domain with correct protocol (`https://`)
3. Check browser console for specific error

### Gemini Audio Not Working

1. Verify `GEMINI_API_KEY` is set correctly
2. Check server logs for Gemini connection errors
3. Ensure WebSocket connections aren't being blocked

### 502 Bad Gateway

1. Verify the Node.js server is running: `pm2 status`
2. Check server logs: `pm2 logs fibbage`
3. Restart if needed: `pm2 restart fibbage`

---

## Support

- Gemini API: https://ai.google.dev/docs
- Socket.IO: https://socket.io/docs/v4/
- PM2: https://pm2.keymetrics.io/docs/
- Nginx: https://nginx.org/en/docs/

---

*Happy hosting! 🎮*

