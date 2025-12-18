import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  isReconnecting: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  isReconnecting: false,
});

export const useSocket = () => {
  const context = useContext(SocketContext);
  return context.socket;
};

export const useSocketStatus = () => {
  const context = useContext(SocketContext);
  return {
    isConnected: context.isConnected,
    isReconnecting: context.isReconnecting,
  };
};

// Get server URL from environment or use current origin
const getServerUrl = () => {
  // Explicit server URL via environment variable
  if (import.meta.env.VITE_SERVER_URL) {
    return import.meta.env.VITE_SERVER_URL;
  }
  // Development: use localhost
  if (import.meta.env.DEV) {
    return 'http://localhost:3001';
  }
  // Production: use same origin (served from same domain)
  return window.location.origin;
};

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  // Track if we've ever connected (for seamless reconnects)
  const hasConnectedRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);

  useEffect(() => {
    const serverUrl = getServerUrl();
    console.log('🔌 Initializing socket connection to:', serverUrl);

    const newSocket = io(serverUrl, {
      // Aggressive reconnection settings for mobile Chrome
      reconnection: true,              // Enable auto-reconnection
      reconnectionAttempts: Infinity,  // Try indefinitely
      reconnectionDelay: 300,          // Initial delay: 300ms (very fast)
      reconnectionDelayMax: 2000,      // Max delay: 2s (very fast)
      timeout: 8000,                   // Connection timeout: 8s
      transports: ['websocket', 'polling'], // Use WebSocket, fallback to polling

      // Force WebSocket upgrade
      upgrade: true,
      rememberUpgrade: true,

      // Auto-connect
      autoConnect: true,
    });

    // Custom heartbeat to detect dead connections faster
    let heartbeatInterval: NodeJS.Timeout;
    let heartbeatTimeout: NodeJS.Timeout;

    const startHeartbeat = () => {
      // Clear any existing intervals
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      if (heartbeatTimeout) clearTimeout(heartbeatTimeout);

      // Send heartbeat every 8 seconds (more frequent for mobile)
      heartbeatInterval = setInterval(() => {
        if (newSocket.connected) {
          console.log('💓 Sending heartbeat...');
          newSocket.emit('ping');

          // If no pong in 4 seconds, force reconnect
          heartbeatTimeout = setTimeout(() => {
            console.warn('💔 No heartbeat response - forcing reconnect');
            newSocket.disconnect();
            // Small delay before reconnect to avoid "forced close"
            setTimeout(() => newSocket.connect(), 200);
          }, 4000);
        }
      }, 8000);
    };

    const stopHeartbeat = () => {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      if (heartbeatTimeout) clearTimeout(heartbeatTimeout);
    };

    // Connection event handlers
    newSocket.on('connect', () => {
      const wasReconnect = hasConnectedRef.current;
      hasConnectedRef.current = true;
      reconnectAttemptsRef.current = 0;

      console.log('✅ Connected to server:', newSocket.id);
      console.log(`   Transport: ${newSocket.io.engine.transport.name}`);

      if (wasReconnect) {
        console.log('🔄 Successfully reconnected!');
      }

      setIsConnected(true);
      setIsReconnecting(false);
      startHeartbeat();
    });

    newSocket.on('disconnect', (reason) => {
      console.warn('❌ Disconnected:', reason);
      console.warn(`   Will attempt to reconnect...`);

      setIsConnected(false);
      setIsReconnecting(true);
      stopHeartbeat();

      // Special handling for different disconnect reasons
      if (reason === 'io server disconnect') {
        // Server initiated disconnect - reconnect with delay
        console.log('🔄 Server disconnected us - reconnecting in 200ms');
        setTimeout(() => newSocket.connect(), 200);
      } else if (reason === 'transport close' || reason === 'transport error') {
        // Network/Chrome mobile issue - add small delay to avoid forced close
        console.log('🔄 Transport closed - reconnecting in 300ms');
        setTimeout(() => {
          if (!newSocket.connected) {
            newSocket.connect();
          }
        }, 300);
      } else if (reason === 'ping timeout') {
        // Ping timeout - reconnect immediately
        console.log('🔄 Ping timeout - reconnecting immediately');
        newSocket.connect();
      }
    });

    // Handle pong response
    newSocket.on('pong', () => {
      console.log('💚 Heartbeat response received');
      if (heartbeatTimeout) clearTimeout(heartbeatTimeout);
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error.message);
      setIsReconnecting(true);
    });

    newSocket.on('reconnect_attempt', (attempt) => {
      reconnectAttemptsRef.current = attempt;
      console.log(`🔄 Reconnection attempt #${attempt}`);
      setIsReconnecting(true);
    });

    newSocket.on('reconnect', (attemptNumber) => {
      console.log(`✅ Reconnected after ${attemptNumber} attempt(s)`);
      setIsConnected(true);
      setIsReconnecting(false);
      reconnectAttemptsRef.current = 0;
      startHeartbeat();
    });

    newSocket.on('reconnect_error', (error) => {
      console.error('❌ Reconnection error:', error.message);
    });

    newSocket.on('reconnect_failed', () => {
      console.error('❌ Reconnection failed - all attempts exhausted');
      setIsReconnecting(false);
    });

    // Handle page visibility changes (mobile backgrounding)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('📱 App backgrounded - pausing heartbeat');
        stopHeartbeat();
      } else {
        console.log('📱 App foregrounded - resuming connection');
        if (!newSocket.connected) {
          console.log('🔄 Reconnecting after background...');
          newSocket.connect();
        } else {
          startHeartbeat();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Handle page focus (additional safety)
    const handleFocus = () => {
      if (!newSocket.connected) {
        console.log('🔄 Window focused - reconnecting...');
        newSocket.connect();
      }
    };

    window.addEventListener('focus', handleFocus);

    setSocket(newSocket);

    return () => {
      stopHeartbeat();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      newSocket.close();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected, isReconnecting }}>
      {children}
    </SocketContext.Provider>
  );
};

