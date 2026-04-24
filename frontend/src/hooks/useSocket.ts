/**
 * BUG-13 FIX: Shared Socket.io hook
 * 
 * Manages a single Socket.io connection for the entire app lifecycle,
 * preventing connection leaks when navigating between Dashboard and Campaigns.
 */

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useApi } from '../contexts/ApiContext';

// Module-level singleton — shared across all components
let sharedSocket: Socket | null = null;
let refCount = 0;

function getSocket(apiUrl: string): Socket {
  if (!sharedSocket || sharedSocket.disconnected) {
    sharedSocket = io(apiUrl, { transports: ['polling', 'websocket'] });
  }
  refCount++;
  return sharedSocket;
}

function releaseSocket() {
  refCount--;
  if (refCount <= 0 && sharedSocket) {
    sharedSocket.disconnect();
    sharedSocket = null;
    refCount = 0;
  }
}

/**
 * Hook to subscribe to a specific socket event using the shared connection.
 * 
 * @param event - Socket event name to listen for
 * @param handler - Callback when the event fires
 */
export function useSocket(event: string, handler: (...args: unknown[]) => void) {
  const { apiUrl } = useApi();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const socket = getSocket(apiUrl);

    const wrappedHandler = (...args: unknown[]) => {
      handlerRef.current(...args);
    };

    socket.on(event, wrappedHandler);

    return () => {
      socket.off(event, wrappedHandler);
      releaseSocket();
    };
  }, [apiUrl, event]);
}
