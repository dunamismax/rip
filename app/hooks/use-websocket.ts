import { useCallback, useEffect, useRef, useState } from 'react';
import type { WsMessage } from '~/lib/types';

type UseWebSocketOptions = {
  onMessage: (msg: WsMessage) => void;
};

const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30_000;

export function useWebSocket({ onMessage }: UseWebSocketOptions) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retriesRef = useRef(0);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/ws`);

    ws.onopen = () => {
      setConnected(true);
      retriesRef.current = 0;
    };
    ws.onclose = () => {
      setConnected(false);
      // Exponential backoff with jitter
      const delay = Math.min(BASE_DELAY_MS * 2 ** retriesRef.current, MAX_DELAY_MS);
      const jitter = delay * 0.2 * Math.random();
      retriesRef.current++;
      reconnectTimerRef.current = setTimeout(connect, delay + jitter);
    };
    ws.onerror = () => {
      ws.close();
    };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WsMessage;
        onMessageRef.current(msg);
      } catch {
        // ignore malformed messages
      }
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connect();
    return () => {
      // Clear pending reconnect timer to prevent orphaned WebSockets
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      wsRef.current?.close();
    };
  }, [connect]);

  return { connected };
}
