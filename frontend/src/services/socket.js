import { io } from 'socket.io-client';

const getSocketURL = () => {
  if (import.meta.env.VITE_SOCKET_URL && import.meta.env.VITE_SOCKET_URL.trim() !== '') {
    return import.meta.env.VITE_SOCKET_URL.trim();
  }
  if (import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL.trim() !== '') {
    return import.meta.env.VITE_API_URL.trim().replace(/\/api\/?$/, '');
  }
  if (
    typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1'
  ) {
    return window.location.origin;
  }
  return 'http://localhost:5050';
};

let socket;

export const getSocket = () => {
  if (!socket) {
    socket = io(getSocketURL(), {
      autoConnect: true,
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      timeout: 5000,
    });
  }
  return socket;
};
