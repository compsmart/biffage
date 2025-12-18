const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require("socket.io");
const cors = require('cors');
require('dotenv').config({ path: '../.env' }); // Look for .env in root
const { GoogleGenAI } = require('@google/genai');

const RoomManager = require('./RoomManager');

const app = express();
const server = http.createServer(app);

// CORS configuration - allow specific origins in production
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://localhost:3001'];

const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? allowedOrigins : "*",
    methods: ["GET", "POST"]
  },
  // Ultra-aggressive ping/pong for mobile Chrome (kills connections at 30s)
  pingTimeout: 15000,      // How long to wait for pong before considering connection dead (15s)
  pingInterval: 3000,      // How often to send ping (3s - combat 30s Chrome timeout)
  upgradeTimeout: 10000,   // Time to wait for upgrade to succeed
  transports: ['websocket', 'polling'], // Allow both for fallback
  allowEIO3: true,         // Allow Engine.IO v3 clients (backwards compatibility)
  connectTimeout: 45000,   // Max time to wait for initial connection
  maxHttpBufferSize: 1e6,  // 1MB buffer size
  perMessageDeflate: false // Disable compression for lower latency
});

app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? allowedOrigins : "*"
}));
app.use(express.json());

// Serve static files from the built client in production
if (process.env.NODE_ENV === 'production') {
  const clientBuildPath = path.join(__dirname, '../client/dist');
  app.use(express.static(clientBuildPath));
}

const roomManager = new RoomManager(io);

// Removed /api/token endpoint - server handles Gemini directly

io.on('connection', (socket) => {
  const connectTime = new Date().toISOString();
  console.log(`[${connectTime}] ✅ User connected:`, socket.id);
  console.log(`   Transport: ${socket.conn.transport.name}`);
  console.log(`   User-Agent: ${socket.handshake.headers['user-agent']?.substring(0, 100)}`);
  console.log(`   IP: ${socket.handshake.address}`);

  // Custom ping/pong handler for mobile keep-alive
  let lastPing = Date.now();
  socket.on('ping', () => {
    const now = Date.now();
    const timeSinceLastPing = now - lastPing;
    lastPing = now;
    console.log(`[${new Date().toISOString()}] 💓 Ping from ${socket.id} (${timeSinceLastPing}ms since last)`);
    socket.emit('pong');
  });

  // Monitor transport changes
  socket.conn.on('upgrade', (transport) => {
    console.log(`[${new Date().toISOString()}] ⬆️ Transport upgraded to ${transport.name} for ${socket.id}`);
  });

  // Monitor connection close
  socket.conn.on('close', (reason) => {
    const disconnectTime = new Date().toISOString();
    const connectionDuration = Date.now() - new Date(connectTime).getTime();
    console.log(`[${disconnectTime}] 🔌 Connection closed for ${socket.id}`);
    console.log(`   Reason: ${reason}`);
    console.log(`   Duration: ${(connectionDuration / 1000).toFixed(1)}s`);
  });

  // Monitor packet errors
  socket.conn.on('error', (error) => {
    console.error(`[${new Date().toISOString()}] ❌ Connection error for ${socket.id}:`, error.message);
  });

  // Monitor ping/pong
  socket.conn.on('ping', () => {
    console.log(`[${new Date().toISOString()}] 📡 Server->Client ping for ${socket.id}`);
  });

  socket.conn.on('pong', () => {
    console.log(`[${new Date().toISOString()}] 📡 Client->Server pong from ${socket.id}`);
  });

  socket.on('join_host', () => {
    console.log(`[${new Date().toISOString()}] 🎮 Host joined: ${socket.id}`);
    roomManager.createRoom(socket);
  });

  socket.on('join_player', ({ roomCode, playerName }) => {
    console.log(`[${new Date().toISOString()}] 🎮 Player joined: ${socket.id}, Room: ${roomCode}, Name: ${playerName}`);
    roomManager.joinRoom(socket, roomCode, playerName);
  });

  socket.on('check_room', ({ roomCode }) => {
    const active = roomManager.isRoomActive(roomCode);
    socket.emit('room_check_result', { roomCode, active });
  });

  socket.on('submit_lie', ({ roomCode, lie }) => {
    roomManager.handleLie(socket, roomCode, lie);
  });

  socket.on('submit_vote', ({ roomCode, choiceId }) => {
    roomManager.handleVote(socket, roomCode, choiceId);
  });

  socket.on('request_next', ({ roomCode }) => {
     roomManager.handleNext(socket, roomCode);
  });

  socket.on('set_auto_progress', ({ roomCode, enabled }) => {
     roomManager.handleSetAutoProgress(socket, roomCode, enabled);
  });

  socket.on('disconnect', (reason) => {
    const disconnectTime = new Date().toISOString();
    const connectionDuration = Date.now() - new Date(connectTime).getTime();
    console.log(`[${disconnectTime}] ❌ User disconnected: ${socket.id}`);
    console.log(`   Reason: ${reason}`);
    console.log(`   Duration: ${(connectionDuration / 1000).toFixed(1)}s`);
    roomManager.handleDisconnect(socket);
  });

  socket.on('error', (error) => {
    console.error(`[${new Date().toISOString()}] ❌ Socket error for ${socket.id}:`, error);
  });
});

// Catch-all route for client-side routing (must be after all API routes)
// Commented out as nginx handles serving the client files
// if (process.env.NODE_ENV === 'production') {
//   const clientBuildPath = path.join(__dirname, '../client/dist');
//   app.get('*', (req, res) => {
//     res.sendFile(path.join(clientBuildPath, 'index.html'));
//   });
// }

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
});
