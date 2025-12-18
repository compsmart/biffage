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
  }
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
  console.log('User connected:', socket.id);

  socket.on('join_host', () => {
    roomManager.createRoom(socket);
  });

  socket.on('join_player', ({ roomCode, playerName }) => {
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

  socket.on('disconnect', () => {
    roomManager.handleDisconnect(socket);
  });
});

// Catch-all route for client-side routing (must be after all API routes)
if (process.env.NODE_ENV === 'production') {
  const clientBuildPath = path.join(__dirname, '../client/dist');
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
});
