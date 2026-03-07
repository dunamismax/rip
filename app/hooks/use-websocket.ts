import { useCallback, useEffect, useRef, useState } from 'react';
import { getWebSocketUrl } from '~/lib/network';
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
  const shouldReconnectRef = useRef(true);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retriesRef = useRef(0);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    if (!shouldReconnectRef.current) return;

    const ws = new WebSocket(getWebSocketUrl('/api/ws'));

    ws.onopen = () => {
      if (wsRef.current !== ws) return;
      setConnected(true);
      retriesRef.current = 0;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
    ws.onclose = () => {
      if (wsRef.current === ws) {
        wsRef.current = null;
      }
      setConnected(false);
      if (!shouldReconnectRef.current) return;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
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
    shouldReconnectRef.current = true;
    connect();
    return () => {
      shouldReconnectRef.current = false;
      // Clear pending reconnect timer to prevent orphaned WebSockets
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      setConnected(false);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect]);

  return { connected };
}
