const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
require('dotenv').config({ path: '../.env' }); // Look for .env in root
const { GoogleGenAI } = require('@google/genai');

const RoomManager = require('./RoomManager');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all for dev
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

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

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
