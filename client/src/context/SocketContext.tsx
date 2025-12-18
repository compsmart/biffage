import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const SocketContext = createContext<Socket | null>(null);

export const useSocket = () => {
  return useContext(SocketContext);
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

