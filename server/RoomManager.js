const Game = require('./Game');

class RoomManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map(); // roomCode -> Game instance
    this.socketToRoom = new Map(); // socketId -> roomCode
  }

  generateRoomCode() {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
  }

  isRoomActive(roomCode) {
    return this.rooms.has(roomCode);
  }

  createRoom(hostSocket) {
    const roomCode = this.generateRoomCode();
    // Pass socket.io to Game for generic events, but Game also now handles Gemini logic internally if we move it there.
    // However, Plan Step 2 says "Integrate GeminiService into Game class".
    const game = new Game(this.io, roomCode, hostSocket.id);
    game.initializeGemini(); // Start AI
    
    this.rooms.set(roomCode, game);
    this.socketToRoom.set(hostSocket.id, roomCode);
    
    hostSocket.join(roomCode);
    hostSocket.emit('room_created', { roomCode });
    console.log(`Room created: ${roomCode} by host ${hostSocket.id}`);
  }

  joinRoom(playerSocket, roomCode, playerName) {
    const game = this.rooms.get(roomCode);
    if (!game) {
      playerSocket.emit('error', { message: 'Room not found' });
      return;
    }

    if (game.state !== 'LOBBY') {
       // Allow reconnect?
    }

    this.socketToRoom.set(playerSocket.id, roomCode);
    playerSocket.join(roomCode);
    
    game.addPlayer(playerSocket.id, playerName);
  }

  handleLie(socket, roomCode, lie) {
    const game = this.rooms.get(roomCode);
    if (game) game.receiveLie(socket.id, lie);
  }

  handleVote(socket, roomCode, choiceId) {
    const game = this.rooms.get(roomCode);
    if (game) game.receiveVote(socket.id, choiceId);
  }
  
  handleNext(socket, roomCode) {
      const game = this.rooms.get(roomCode);
      if (game && game.hostSocketId === socket.id) {
          game.nextState();
      }
  }
  
  handleSetAutoProgress(socket, roomCode, enabled) {
      const game = this.rooms.get(roomCode);
      if (game && game.hostSocketId === socket.id) {
          game.setAutoProgress(enabled);
      }
  }

  handleDisconnect(socket) {
    const roomCode = this.socketToRoom.get(socket.id);
    if (roomCode) {
      const game = this.rooms.get(roomCode);
      if (game) {
        game.removePlayer(socket.id);
        if (game.hostSocketId === socket.id) {
            console.log(`Host left room ${roomCode}`);
            // Clean up Gemini connection
            if (game.gemini) {
                game.gemini.ws?.close();
            }
            this.rooms.delete(roomCode);
        }
      }
      this.socketToRoom.delete(socket.id);
    }
  }
}

module.exports = RoomManager;
