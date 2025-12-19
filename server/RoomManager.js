const Game = require('./Game');
const hostPersonas = require('./hostPersonas');

class RoomManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map(); // roomCode -> Game instance
    this.socketToRoom = new Map(); // socketId -> roomCode
  }

  generateRoomCode() {
    // Letters only, excluding l, i, and o to avoid confusion
    const letters = 'ABCDEFGHJKMNPQRSTUVWXYZ'; // 23 letters (A-Z excluding I, L, O)
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += letters[Math.floor(Math.random() * letters.length)];
    }
    return code;
  }

  isRoomActive(roomCode) {
    return this.rooms.has(roomCode);
  }

  createRoom(hostSocket) {
    const roomCode = this.generateRoomCode();
    // Pass socket.io to Game for generic events, but Game also now handles Gemini logic internally if we move it there.
    // However, Plan Step 2 says "Integrate GeminiService into Game class".
    const game = new Game(this.io, roomCode, hostSocket.id);

    // Pick an initial random host persona for this room
    const persona = hostPersonas[Math.floor(Math.random() * hostPersonas.length)];
    game.initializeGemini(persona); // Start AI with persona
    
    this.rooms.set(roomCode, game);
    this.socketToRoom.set(hostSocket.id, roomCode);
    
    hostSocket.join(roomCode);
    hostSocket.emit('room_created', { roomCode });
    
    // Small delay to ensure socket is fully joined to room before broadcasting
    // Also emit directly to host socket as backup
    setTimeout(() => {
      console.log(`[Room ${roomCode}] Broadcasting initial game_state...`);
      try {
        game.broadcastState();
        console.log(`[Room ${roomCode}] Successfully broadcast game_state to room`);
      } catch (error) {
        console.error(`[Room ${roomCode}] Error broadcasting game_state:`, error);
      }
    }, 100);
    
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

  handleChangePersona(socket, roomCode, personaId) {
    const game = this.rooms.get(roomCode);
    if (!game || game.hostSocketId !== socket.id) return;

    const persona = hostPersonas.find(p => p.id === personaId);
    if (!persona) return;

    // Close existing Gemini connection if any
    if (game.gemini && game.gemini.ws) {
      try {
        game.gemini.ws.close();
      } catch (e) {
        console.error('Error closing Gemini websocket on persona change:', e);
      }
      game.gemini = null;
    }

    // Re-initialize Gemini with new persona
    game.initializeGemini(persona);

    // Update clients with new persona immediately
    game.broadcastState();
  }

  handleSetFamilyMode(socket, roomCode, enabled) {
    const game = this.rooms.get(roomCode);
    if (!game || game.hostSocketId !== socket.id) return;

    game.setFamilyMode(enabled);
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
