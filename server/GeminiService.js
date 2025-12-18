const { GoogleGenAI } = require('@google/genai');
const WebSocket = require('ws');

class GeminiService {
  constructor(apiKey, onAudioData) {
    this.apiKey = apiKey;
    this.onAudioData = onAudioData; // Callback to send audio to client
    this.ws = null;
    this.isConnected = false;
  }

  connect() {
    if (this.ws) return;

    // Server-side connection using raw WebSocket to Gemini Live
    // Note: Server-to-Server usually uses S2S API or just standard API key.
    // We'll use the URL with API key.
    const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${this.apiKey}`;
    
    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      console.log('Gemini Service Connected');
      this.isConnected = true;
      this.sendSetup();
    });

    this.ws.on('message', (data) => {
        try {
            // Data is Buffer in Node.js ws
            const response = JSON.parse(data.toString());
            if (response.serverContent && response.serverContent.modelTurn && response.serverContent.modelTurn.parts) {
                for (const part of response.serverContent.modelTurn.parts) {
                    if (part.inlineData && part.inlineData.mimeType.startsWith('audio/pcm')) {
                         // Extract Base64 audio
                         // We need to send it to the client. 
                         // To save bandwidth/processing, we can send the base64 string directly
                         // or the buffer. Socket.io handles buffers well.
                         const audioBuffer = Buffer.from(part.inlineData.data, 'base64');
                         if (this.onAudioData) this.onAudioData(audioBuffer);
                    }
                }
            }
        } catch (e) {
            console.error("Error parsing Gemini message", e);
        }
    });

    this.ws.on('close', () => {
      console.log('Gemini Service Disconnected');
      this.isConnected = false;
      this.ws = null;
    });
    
    this.ws.on('error', (err) => {
        console.error('Gemini Service Error:', err);
    });
  }

  sendSetup() {
    const setupMsg = {
        setup: {
          model: "models/gemini-2.5-flash-native-audio-preview-09-2025", 
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } } 
            }
          },
          systemInstruction: {
            parts: [{ text: `
You are the host of "Fibbage Clone", a bluffing party game. 
You are an australian, talk with an aussie accent.
Your persona is witty, sarcastic, slightly roasting the players, but ultimately fun and energetic.
You will receive JSON updates about the game state. 
Your job is to read the content for the players (questions, answers) and add commentary.
DO NOT read the JSON keys. Interpret the data and speak naturally as a game show host.

Events you will handle:
- LOBBY: Welcome players, make fun of their names if they are silly.
- QUESTION: Read the question clearly. Then tell them to write a lie.
- VOTING: Tell them to find the truth. The lies are on the screen.
- REVEAL: Reveal the truth. Roast the people who got it wrong. Congratulate the truth-finders.
- SCOREBOARD: Read the leader.
            ` }]
          }
        }
    };
    this.sendMessage(setupMsg);
  }

  sendContext(text) {
      if (!this.isConnected) return;
      const msg = {
          clientContent: {
              turns: [{ parts: [{ text: text }], role: "user" }],
              turnComplete: true
          }
      };
      this.sendMessage(msg);
  }

  sendMessage(msg) {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify(msg));
      }
  }
}

module.exports = GeminiService;

