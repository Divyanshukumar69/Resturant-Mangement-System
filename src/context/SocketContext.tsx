import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';

const SocketContext = createContext<Socket | null>(null);

const SOCKET_URL = import.meta.env.DEV
  ? `http://${window.location.hostname}:3000`
  : window.location.origin;

export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const [socket] = useState<Socket>(() => io(SOCKET_URL, {
    path: '/socket.io/',
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
    transports: ['websocket', 'polling'],
  }));

  useEffect(() => {
    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id);
    });

    socket.on('connect_error', (err) => {
      console.warn('[Socket] Connection error:', err.message);
    });

    return () => {
      socket.off('connect');
      socket.off('connect_error');
      socket.disconnect();
    };
  }, [socket]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
