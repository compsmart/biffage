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
    
    // Session management (per Gemini Live API docs)
    this.sessionHandle = null; // For session resumption
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // Start with 1 second
    this.isReconnecting = false;
    this.pendingMessages = []; // Queue messages during reconnection
    this.lastContext = null; // Store last context for reconnection
    this.onDisconnect = null; // Callback for disconnect events
    this.onReconnect = null; // Callback for reconnect events
    
    // Diagnostic tracking
    this.lastMessageSentTime = null;
    this.lastResponseTime = null;
    this.responseTimeoutId = null;
    this.audioChunkCount = 0;
    this.messageCount = 0;
    this.RESPONSE_TIMEOUT_MS = 30000; // 30 seconds without response = problem
    
    // Heartbeat to detect dead connections
    this.heartbeatIntervalId = null;
    this.HEARTBEAT_INTERVAL_MS = 15000; // Check every 15 seconds
    
    // Keep-alive to prevent idle timeout (sends empty clientContent)
    this.keepAliveIntervalId = null;
    this.KEEPALIVE_INTERVAL_MS = 15000; // Send every 15 seconds
    
    // GoAway handling - flag to track pending reconnection due to GoAway
    this.goAwayPending = false;
  }

  setDisconnectCallback(callback) {
    this.onDisconnect = callback;
  }

  setReconnectCallback(callback) {
    this.onReconnect = callback;
  }

  // Start a timeout to detect when Gemini stops responding
  startResponseTimeout(context = 'unknown') {
    this.clearResponseTimeout();
    this.responseTimeoutId = setTimeout(() => {
      const wsState = this.ws ? this.ws.readyState : null;
      const timeSinceLastResponse = this.lastResponseTime 
        ? Math.round((Date.now() - this.lastResponseTime) / 1000) 
        : 'never';
      const timeSinceLastSent = this.lastMessageSentTime 
        ? Math.round((Date.now() - this.lastMessageSentTime) / 1000) 
        : 'never';
      console.error(`[Gemini] ⚠️ RESPONSE TIMEOUT after ${this.RESPONSE_TIMEOUT_MS/1000}s`);
      console.error(`[Gemini] Context: "${context.substring(0, 100)}..."`);
      console.error(`[Gemini] Time since last response: ${timeSinceLastResponse}s`);
      console.error(`[Gemini] Time since last message sent: ${timeSinceLastSent}s`);
      console.error(`[Gemini] Audio chunks received this session: ${this.audioChunkCount}`);
      console.error(`[Gemini] Total messages received: ${this.messageCount}`);
      console.error(`[Gemini] WebSocket state: ${wsState} (0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED, null=destroyed)`);
      
      // If WebSocket is dead, attempt reconnection
      if (wsState === null || wsState === WebSocket.CLOSED || wsState === WebSocket.CLOSING) {
        console.log('[Gemini] WebSocket is dead, attempting reconnection...');
        this.isConnected = false;
        this.reconnectAttempts = 0; // Reset attempts for this recovery
        this.scheduleReconnect();
      } else if (wsState === WebSocket.OPEN) {
        // WebSocket appears open but no response - could be a silent failure
        console.warn('[Gemini] WebSocket appears open but not responding. Forcing reconnect...');
        try {
          this.ws.terminate();
        } catch (e) {
          // Ignore
        }
        this.ws = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.scheduleReconnect();
      }
    }, this.RESPONSE_TIMEOUT_MS);
  }

  clearResponseTimeout() {
    if (this.responseTimeoutId) {
      clearTimeout(this.responseTimeoutId);
      this.responseTimeoutId = null;
    }
  }

  // Start heartbeat to detect dead connections
  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatIntervalId = setInterval(() => {
      const wsState = this.ws ? this.ws.readyState : null;
      const timeSinceLastResponse = this.lastResponseTime 
        ? Math.round((Date.now() - this.lastResponseTime) / 1000) 
        : null;
      
      // Log connection health periodically
      if (timeSinceLastResponse !== null && timeSinceLastResponse > 60) {
        console.warn(`[Gemini] ⚠️ Heartbeat: No response in ${timeSinceLastResponse}s, WebSocket state: ${wsState}`);
      }
      
      // Check if WebSocket died without triggering close event
      if (this.isConnected && (wsState === null || wsState === WebSocket.CLOSED)) {
        console.error('[Gemini] ❌ Heartbeat detected dead WebSocket! Triggering reconnect...');
        this.isConnected = false;
        this.stopHeartbeat();
        this.reconnectAttempts = 0;
        this.scheduleReconnect();
      }
    }, this.HEARTBEAT_INTERVAL_MS);
  }

  stopHeartbeat() {
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }
  }

  // Start keep-alive to prevent idle timeout by sending empty clientContent
  startKeepAlive() {
    this.stopKeepAlive();
    this.keepAliveIntervalId = setInterval(() => {
      if (this.ws && this.isConnected && this.ws.readyState === WebSocket.OPEN) {
        try {
          // Send empty clientContent as keepalive (Gemini accepts this)
          const keepAlive = {
            clientContent: {
              turns: [],
              turnComplete: false
            }
          };
          this.ws.send(JSON.stringify(keepAlive));
        } catch (e) {
          console.error('[Gemini] Error sending keepalive:', e);
          // If keepalive fails, connection is likely dead - trigger reconnection
          this.isConnected = false;
          if (!this.isReconnecting && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        }
      }
    }, this.KEEPALIVE_INTERVAL_MS);
  }

  stopKeepAlive() {
    if (this.keepAliveIntervalId) {
      clearInterval(this.keepAliveIntervalId);
      this.keepAliveIntervalId = null;
    }
  }

  // Cleanup all intervals, timeouts, and listeners before reconnecting
  cleanup() {
    this.stopHeartbeat();
    this.stopKeepAlive();
    this.clearResponseTimeout();
    
    // Remove all listeners from the old WebSocket to prevent memory leaks
    if (this.ws) {
      this.ws.removeAllListeners();
    }
  }

  connect() {
    if (this.isReconnecting && this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.warn('[Gemini] Connection already exists and is open, skipping connect');
      return;
    }

    // Clean up any existing connection properly
    if (this.ws) {
      this.cleanup();
      try {
        this.ws.terminate();
      } catch (e) {
        // Ignore cleanup errors
      }
      this.ws = null;
    }

    if (!this.apiKey) {
      console.error('[Gemini] No API key provided! Cannot connect.');
      return;
    }

    const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${this.apiKey.substring(0, 10)}...`;
    console.log(`[Gemini] Attempting to connect to Gemini WebSocket (API key: ${this.apiKey ? 'present' : 'MISSING'})`);
    console.log(`[Gemini] Connection URL (masked): ${url}`);
    if (this.sessionHandle) {
      console.log(`[Gemini] Attempting to resume session with handle: ${this.sessionHandle.substring(0, 20)}...`);
    }
    
    const fullUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${this.apiKey}`;
    
    // Create WebSocket with options for better connection handling
    this.ws = new WebSocket(fullUrl, {
      handshakeTimeout: 30000, // 30 second timeout for handshake
      perMessageDeflate: false // Disable compression for better compatibility
    });

    this.ws.on('open', () => {
      console.log('[Gemini] WebSocket connection opened');
      this.isConnected = true;
      this.isReconnecting = false;
      this.goAwayPending = false;
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000; // Reset delay on successful connection
      this.lastResponseTime = Date.now(); // Reset response timer
      this.messageCount = 0; // Reset message count for new session
      
      // Start heartbeat to detect dead connections
      this.startHeartbeat();
      
      // Start keep-alive to prevent idle timeout
      this.startKeepAlive();
      
      try {
        this.sendSetup();
        console.log('[Gemini] Setup message sent successfully');
        
        // If we reconnected, notify callback
        if (this.onReconnect && this.sessionHandle) {
          this.onReconnect();
        }
        
        // Send any pending messages
        this.flushPendingMessages();
      } catch (error) {
        console.error('[Gemini] Error sending setup message:', error);
        console.error('[Gemini] Error stack:', error.stack);
      }
    });

    this.ws.on('message', (data) => {
      try {
        const responseStr = data.toString();
        const response = JSON.parse(responseStr);
        
        // Track response timing
        this.lastResponseTime = Date.now();
        this.messageCount++;
        this.clearResponseTimeout(); // Got a response, clear timeout
        
        // Identify what type of response this is
        const responseTypes = [];
        if (response.setupComplete) responseTypes.push('setupComplete');
        if (response.serverContent) responseTypes.push('serverContent');
        if (response.sessionResumptionUpdate) responseTypes.push('sessionResumption');
        if (response.goAway) responseTypes.push('goAway');
        if (response.toolCall) responseTypes.push('toolCall');
        if (response.toolCallCancellation) responseTypes.push('toolCallCancellation');
        
        // Only log notable responses (skip audio-only responses to reduce noise)
        const hasAudio = response.serverContent?.modelTurn?.parts?.some(p => 
          p.inlineData?.mimeType?.startsWith('audio/'));
        const hasTurnComplete = response.serverContent?.turnComplete;
        const hasText = response.serverContent?.modelTurn?.parts?.some(p => p.text);
        const hasToolCall = response.serverContent?.modelTurn?.parts?.some(p => p.functionCall);
        
        // Only log if there's something notable (not just audio data)
        const isNotable = hasTurnComplete || hasText || hasToolCall || 
                          response.setupComplete || response.goAway || 
                          response.sessionResumptionUpdate;
        
        if (isNotable) {
          console.log(`[Gemini] Response #${this.messageCount} | Types: [${responseTypes.join(', ')}] | TurnComplete: ${hasTurnComplete ? 'yes' : 'no'} | Text: ${hasText ? 'yes' : 'no'}`);
        }
        
        // Handle session resumption updates (per Live API docs)
        if (response.sessionResumptionUpdate) {
          const update = response.sessionResumptionUpdate;
          if (update.resumable && update.newHandle) {
            console.log('[Gemini] Received new session handle for resumption');
            this.sessionHandle = update.newHandle;
          }
        }
        
        // Handle setupComplete
        if (response.setupComplete) {
          console.log('[Gemini] ✓ Setup completed successfully');
        }
        
        // Handle GoAway message - server is about to disconnect (per Live API docs)
        // Proactively close and reconnect before the server kills the connection
        if (response.goAway) {
          const timeLeftStr = response.goAway.timeLeft;
          console.warn(`[Gemini] ⚠️ Received GoAway message - connection will close in ${timeLeftStr}`);
          console.log('[Gemini] Preparing for proactive session resumption...');
          
          // Parse the timeLeft (format like "30s" or "1m30s")
          let timeLeftMs = 1000; // Default to 1 second if parsing fails
          if (timeLeftStr) {
            const match = timeLeftStr.match(/^(\d+(?:\.\d+)?)s$/);
            if (match) {
              timeLeftMs = Math.max(100, (parseFloat(match[1]) - 1) * 1000); // Leave 1s buffer
            }
          }
          
          // Cap at 5 seconds max wait - we don't want to wait too long
          timeLeftMs = Math.min(timeLeftMs, 5000);
          
          // Set flag to indicate GoAway-triggered reconnection
          this.goAwayPending = true;
          
          // Reset reconnect attempts to ensure quick reconnection
          this.reconnectAttempts = 0;
          
          // Notify callback
          if (this.onDisconnect) {
            this.onDisconnect('goaway', timeLeftStr);
          }
          
          // Proactively close and reconnect before the server kills the connection
          console.log(`[Gemini] Will reconnect in ${timeLeftMs}ms due to GoAway`);
          setTimeout(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
              console.log('[Gemini] Closing connection proactively due to GoAway...');
              this.ws.close(1000, 'GoAway received');
            }
          }, timeLeftMs);
        }
        
        // Log server responses for debugging
        if (response.serverContent) {
          // Check for errors in server response
          if (response.serverContent.error) {
            console.error('[Gemini] ❌ Server error in response:', JSON.stringify(response.serverContent.error, null, 2));
          }
          
          // Check for model turn errors
          if (response.serverContent.modelTurn && response.serverContent.modelTurn.error) {
            console.error('[Gemini] ❌ Model turn error:', JSON.stringify(response.serverContent.modelTurn.error, null, 2));
          }
          
          // Check for interrupted flag
          if (response.serverContent.interrupted) {
            console.warn('[Gemini] ⚠️ Response was interrupted');
          }
          
          // Handle generation complete (per Live API docs)
          if (response.serverContent.generationComplete) {
            console.log('[Gemini] Generation complete');
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
              this.audioChunkCount++;
              const audioBuffer = Buffer.from(part.inlineData.data, 'base64');
              // Only log audio chunks at milestones to reduce noise
              if (this.audioChunkCount === 1 || this.audioChunkCount % 100 === 0) {
                console.log(`[Gemini] Audio streaming... (${this.audioChunkCount} chunks received)`);
              }
              if (this.onAudioData) this.onAudioData(audioBuffer);
            }
            
            // Log text responses
            if (part.text) {
              console.log(`[Gemini] Text response: "${part.text.substring(0, 100)}${part.text.length > 100 ? '...' : ''}"`);
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
          console.log(`[Gemini] ✓ Turn complete | Total audio chunks: ${this.audioChunkCount} | Total messages: ${this.messageCount}`);
          this.clearResponseTimeout(); // Clear timeout on turn complete
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
      const reasonStr = reason ? reason.toString() : 'No reason provided';
      console.log(`[Gemini] ❌ WebSocket closed - Code: ${code}, Reason: ${reasonStr}`);
      console.log(`[Gemini] Close code meanings: 1000=Normal, 1001=Going Away, 1002=Protocol Error, 1003=Unsupported Data, 1006=Abnormal Closure, 1011=Server Error`);
      
      this.isConnected = false;
      this.cleanup();
      this.ws = null;
      
      // Check if this was a GoAway-triggered close - always reconnect in that case
      if (this.goAwayPending) {
        console.log('[Gemini] Reconnecting due to GoAway...');
        this.goAwayPending = false;
        this.scheduleReconnect();
        return;
      }
      
      // Determine if we should attempt reconnection
      const shouldReconnect = this.shouldAttemptReconnect(code, reasonStr);
      
      if (shouldReconnect && !this.isReconnecting) {
        console.log(`[Gemini] Will attempt reconnection (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
        this.scheduleReconnect();
      } else if (!shouldReconnect) {
        console.log('[Gemini] Not attempting reconnection based on close code/reason');
        this.sessionHandle = null; // Clear session handle for non-recoverable disconnects
        if (this.onDisconnect) {
          this.onDisconnect('permanent', reasonStr);
        }
      }
    });
    
    this.ws.on('error', (err) => {
      console.error('[Gemini] WebSocket error:', err);
      console.error('[Gemini] Error message:', err.message);
      console.error('[Gemini] Error code:', err.code);
      console.error('[Gemini] Error stack:', err.stack);
      
      this.isConnected = false;
      
      // Handle ECONNRESET and other connection errors - trigger reconnection
      if (err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
        console.log(`[Gemini] Connection error (${err.code}), will attempt reconnection...`);
        
        // Close existing connection if still open
        if (this.ws && this.ws.readyState !== WebSocket.CLOSED && this.ws.readyState !== WebSocket.CLOSING) {
          try {
            this.ws.close();
          } catch (e) {
            console.error('[Gemini] Error closing WebSocket after error:', e);
          }
        }
        
        this.cleanup();
        
        if (!this.isReconnecting && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      }
    });
  }

  shouldAttemptReconnect(code, reason) {
    // Don't reconnect if we've exceeded max attempts
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[Gemini] Max reconnect attempts reached');
      return false;
    }
    
    // Reconnect for these codes (server-side issues, deadline expired, etc.)
    const reconnectCodes = [
      1001, // Going Away - server is shutting down
      1006, // Abnormal Closure - connection lost
      1011, // Server Error - internal server error (includes deadline expired)
      1012, // Service Restart
      1013, // Try Again Later
      1014, // Bad Gateway
    ];
    
    // Also reconnect if reason contains certain keywords
    const reconnectReasons = [
      'deadline expired',
      'timeout',
      'temporary',
      'try again',
      'service unavailable',
    ];
    
    if (reconnectCodes.includes(code)) {
      return true;
    }
    
    const reasonLower = reason.toLowerCase();
    for (const keyword of reconnectReasons) {
      if (reasonLower.includes(keyword)) {
        return true;
      }
    }
    
    // Don't reconnect for normal closures or client-initiated disconnects
    return code !== 1000 && code !== 1005;
  }

  scheduleReconnect() {
    if (this.isReconnecting) {
      console.log('[Gemini] Reconnection already scheduled');
      return;
    }
    
    this.isReconnecting = true;
    this.reconnectAttempts++;
    
    // Exponential backoff with jitter
    const jitter = Math.random() * 500;
    const delay = Math.min(this.reconnectDelay + jitter, 30000); // Max 30 seconds
    
    console.log(`[Gemini] Scheduling reconnection in ${Math.round(delay)}ms`);
    
    setTimeout(() => {
      if (this.isReconnecting) {
        console.log(`[Gemini] Attempting reconnection (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.connect();
      }
    }, delay);
    
    // Increase delay for next attempt (exponential backoff)
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
  }

  flushPendingMessages() {
    if (this.pendingMessages.length > 0) {
      console.log(`[Gemini] Flushing ${this.pendingMessages.length} pending messages`);
      for (const msg of this.pendingMessages) {
        this.sendMessage(msg);
      }
      this.pendingMessages = [];
    }
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
        // Enable context window compression for longer sessions (per Live API docs)
        contextWindowCompression: {
          slidingWindow: {}
        },
        // Enable session resumption (per Live API docs)
        sessionResumption: this.sessionHandle ? {
          handle: this.sessionHandle
        } : {},
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
    // Store last context for potential reconnection
    this.lastContext = text;
    
    // Log the context being sent (truncated if long)
    const truncatedText = text.length > 150 ? text.substring(0, 150) + '...' : text;
    console.log(`[Gemini] Sending context (${text.length} chars): "${truncatedText}"`);
    
    // Reset audio chunk counter for new context
    this.audioChunkCount = 0;
    
    if (!this.isConnected) {
      console.log('[Gemini] Not connected, queueing context message');
      this.pendingMessages.push({
        clientContent: {
          turns: [{ parts: [{ text: text }], role: "user" }],
          turnComplete: true
        }
      });
      return;
    }
    
    const msg = {
      clientContent: {
        turns: [{ parts: [{ text: text }], role: "user" }],
        turnComplete: true
      }
    };
    this.sendMessage(msg);
    
    // Start timeout to detect if Gemini doesn't respond
    this.startResponseTimeout(text);
  }

  sendMessage(msg) {
    // Determine message type and create a summary for logging
    let msgType = 'unknown';
    let msgSummary = '';
    
    if (msg.setup) {
      msgType = 'setup';
      const voice = msg.setup?.generationConfig?.speechConfig?.voiceConfig?.prebuiltVoiceConfig?.voiceName || 'default';
      msgSummary = `model=${msg.setup.model}, voice=${voice}`;
    } else if (msg.clientContent) {
      msgType = 'clientContent';
      const turns = msg.clientContent.turns || [];
      if (turns.length > 0 && turns[0].parts) {
        const textPart = turns[0].parts.find(p => p.text);
        if (textPart) {
          const text = textPart.text;
          msgSummary = text.length > 100 ? text.substring(0, 100) + '...' : text;
          msgSummary = `"${msgSummary}" (${text.length} chars)`;
        }
      }
    } else if (msg.realtimeInput) {
      msgType = 'realtimeInput';
      msgSummary = 'audio/media data';
    }
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        const msgStr = JSON.stringify(msg);
        this.ws.send(msgStr);
        this.lastMessageSentTime = Date.now();
        console.log(`[Gemini] Message sent | Type: ${msgType} | ${msgSummary}`);
      } catch (error) {
        console.error('[Gemini] Error sending message:', error);
        console.error('[Gemini] Message that failed:', JSON.stringify(msg, null, 2));
        console.error('[Gemini] Error stack:', error.stack);
        
        // Queue message for retry if it's a content message
        if (msg.clientContent) {
          console.log('[Gemini] Queueing failed message for retry');
          this.pendingMessages.push(msg);
        }
      }
    } else {
      console.warn(`[Gemini] Cannot send message - WebSocket state: ${this.ws ? this.ws.readyState : 'null'}`);
      console.warn(`[Gemini] WebSocket states: 0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED`);
      
      // Queue message for retry if it's a content message
      if (msg.clientContent) {
        console.log('[Gemini] Queueing message for later delivery');
        this.pendingMessages.push(msg);
      }
    }
  }

  disconnect() {
    console.log('[Gemini] Manually disconnecting');
    this.isReconnecting = false; // Prevent auto-reconnect
    this.goAwayPending = false;
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent further reconnects
    this.cleanup();
    
    if (this.ws) {
      try {
        this.ws.close(1000, 'Client disconnecting');
      } catch (e) {
        console.error('[Gemini] Error closing WebSocket:', e);
        try {
          this.ws.terminate();
        } catch (e2) {
          // Ignore
        }
      }
      this.ws = null;
    }
    
    this.isConnected = false;
    this.sessionHandle = null;
    this.pendingMessages = [];
  }

  // Check if the service is ready to send messages
  isReady() {
    return this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  // Get connection status info
  getStatus() {
    return {
      connected: this.isConnected,
      hasSession: !!this.sessionHandle,
      reconnectAttempts: this.reconnectAttempts,
      pendingMessages: this.pendingMessages.length,
      isReconnecting: this.isReconnecting
    };
  }
}

module.exports = GeminiService;
