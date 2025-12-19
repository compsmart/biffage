const WebSocket = require('ws');
const { getFamilyModePrompt } = require('./prompts/familyModePrompt');
const { getAdultModePrompt } = require('./prompts/adultModePrompt');

class GeminiService {
  constructor(apiKey, onAudioData, onTurnComplete, onEmoji, persona, familyMode = true) {
    this.apiKey = apiKey;
    this.onAudioData = onAudioData; // Callback to send audio to client
    this.onTurnComplete = onTurnComplete; // Callback when AI finishes speaking
    this.onEmoji = onEmoji; // Callback for emoji tool calls
    this.persona = persona || null;
    this.familyMode = familyMode;
    this.ws = null;
    this.isConnected = false;
  }

  connect() {
    if (this.ws) {
      console.warn('[Gemini] Connection already exists, skipping connect');
      return;
    }

    if (!this.apiKey) {
      console.error('[Gemini] No API key provided! Cannot connect.');
      return;
    }

    // Server-side connection using raw WebSocket to Gemini Live
    // Note: Server-to-Server usually uses S2S API or just standard API key.
    // We'll use the URL with API key.
    const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${this.apiKey.substring(0, 10)}...`;
    console.log(`[Gemini] Attempting to connect to Gemini WebSocket (API key: ${this.apiKey ? 'present' : 'MISSING'})`);
    console.log(`[Gemini] Connection URL (masked): ${url}`);
    
    const fullUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${this.apiKey}`;
    this.ws = new WebSocket(fullUrl);

    this.ws.on('open', () => {
      console.log('[Gemini] WebSocket connection opened');
      this.isConnected = true;
      try {
        this.sendSetup();
        console.log('[Gemini] Setup message sent successfully');
      } catch (error) {
        console.error('[Gemini] Error sending setup message:', error);
        console.error('[Gemini] Error stack:', error.stack);
      }
    });

    this.ws.on('message', (data) => {
      try {
        // Data is Buffer in Node.js ws
        const responseStr = data.toString();
        const response = JSON.parse(responseStr);
        
        // Log server responses for debugging
        if (response.serverContent) {
          // Check for errors in server response
          if (response.serverContent.error) {
            console.error('[Gemini] Server error in response:', JSON.stringify(response.serverContent.error, null, 2));
          }
          
          // Check for model turn errors
          if (response.serverContent.modelTurn && response.serverContent.modelTurn.error) {
            console.error('[Gemini] Model turn error:', JSON.stringify(response.serverContent.modelTurn.error, null, 2));
          }
        }
        
        const serverContent = response.serverContent;

        // Handle audio data and potential tool calls
        if (serverContent && serverContent.modelTurn && serverContent.modelTurn.parts) {
          for (const part of serverContent.modelTurn.parts) {
            // Audio streaming
            if (
              part.inlineData &&
              part.inlineData.mimeType &&
              part.inlineData.mimeType.startsWith('audio/pcm')
            ) {
              const audioBuffer = Buffer.from(part.inlineData.data, 'base64');
              if (this.onAudioData) this.onAudioData(audioBuffer);
            }

            // Tool / function calls (e.g., show_emoji)
            if (part.functionCall && this.onEmoji) {
              const { name, args } = part.functionCall;
              if (name === 'show_emoji') {
                try {
                  const parsed = args ? JSON.parse(args) : {};
                  const emoji = parsed.emoji || '🤔';
                  const context = parsed.context || 'question';
                  this.onEmoji({ emoji, context });
                } catch (e) {
                  console.error('Failed to parse show_emoji args', e);
                }
              }
            }
          }
        }

        // Detect when the model has finished its turn
        if (serverContent && serverContent.turnComplete) {
          console.log('Gemini turn complete');
          if (this.onTurnComplete) {
            this.onTurnComplete();
          }
        }
      } catch (e) {
        console.error('[Gemini] Error parsing message:', e);
        console.error('[Gemini] Message data (first 500 chars):', data.toString().substring(0, 500));
        console.error('[Gemini] Error stack:', e.stack);
      }
    });

    this.ws.on('close', (code, reason) => {
      console.log(`[Gemini] WebSocket closed - Code: ${code}, Reason: ${reason ? reason.toString() : 'No reason provided'}`);
      console.log(`[Gemini] Close code meanings: 1000=Normal, 1001=Going Away, 1002=Protocol Error, 1003=Unsupported Data, 1006=Abnormal Closure, 1011=Server Error`);
      this.isConnected = false;
      this.ws = null;
    });
    
    this.ws.on('error', (err) => {
      console.error('[Gemini] WebSocket error:', err);
      console.error('[Gemini] Error message:', err.message);
      console.error('[Gemini] Error code:', err.code);
      console.error('[Gemini] Error stack:', err.stack);
    });
  }

  sendSetup() {
    const voiceName = this.persona && this.persona.voiceName ? this.persona.voiceName : 'Puck';
    console.log(`[Gemini] Sending setup with voice: ${voiceName}, persona: ${this.persona ? this.persona.name : 'none'}`);
    
    const setupMsg = {
      setup: {
        model: 'models/gemini-2.5-flash-native-audio-preview-09-2025',
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voiceName,
              },
            },
          }
        },
        tools: [
          {
            functionDeclarations: [
              {
                name: 'show_emoji',
                description:
                  'Show a single emoji in a thought bubble on the host screen that matches the current moment in the game.',
                parameters: {
                  type: 'object',
                  properties: {
                    emoji: {
                      type: 'string',
                      description:
                        'The emoji to display, e.g. 😂, 🤔, 😱.'
                    },
                    context: {
                      type: 'string',
                      description:
                        'Where this emoji is relevant, e.g. question, reveal, or score.'
                    }
                  },
                  required: ['emoji']
                }
              }
            ]
          }
        ],
        systemInstruction: {
          parts: [
            {
              text: this.familyMode 
                ? getFamilyModePrompt(this.persona)
                : getAdultModePrompt(this.persona)
            }
          ]
        }
      }
    };
    
    // Log setup message structure (without full system instruction text)
    const setupLog = JSON.parse(JSON.stringify(setupMsg));
    if (setupLog.setup && setupLog.setup.systemInstruction && setupLog.setup.systemInstruction.parts) {
      setupLog.setup.systemInstruction.parts = setupLog.setup.systemInstruction.parts.map(part => {
        if (part.text) {
          return { ...part, text: part.text.substring(0, 100) + '... (truncated)' };
        }
        return part;
      });
    }
    console.log('[Gemini] Setup message structure:', JSON.stringify(setupLog, null, 2));
    
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
          try {
            const msgStr = JSON.stringify(msg);
            this.ws.send(msgStr);
            console.log('[Gemini] Message sent successfully');
          } catch (error) {
            console.error('[Gemini] Error sending message:', error);
            console.error('[Gemini] Message that failed:', JSON.stringify(msg, null, 2));
            console.error('[Gemini] Error stack:', error.stack);
          }
      } else {
          console.warn(`[Gemini] Cannot send message - WebSocket state: ${this.ws ? this.ws.readyState : 'null'}`);
          console.warn(`[Gemini] WebSocket states: 0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED`);
      }
  }
}

module.exports = GeminiService;
