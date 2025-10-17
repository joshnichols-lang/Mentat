import { useEffect, useRef, useState, useCallback } from 'react';

interface TradeData {
  coin: string;
  side: string;
  px: string;
  sz: string;
  time: number;
}

interface L2BookLevel {
  px: string;
  sz: string;
  n: number;
}

interface L2BookData {
  coin: string;
  levels: [L2BookLevel[], L2BookLevel[]]; // [bids, asks]
  time: number;
}

interface CandleData {
  coin: string;
  interval: string;
  t: number;
  T: number;
  o: string;
  c: string;
  h: string;
  l: string;
  v: string;
  n: number;
}

type MarketDataMessage = {
  type: 'trade';
  data: TradeData;
} | {
  type: 'orderBook';
  data: L2BookData;
} | {
  type: 'candle';
  data: CandleData;
};

export function useMarketDataWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const [isConnected, setIsConnected] = useState(false);
  const listenersRef = useRef<Map<string, (data: any) => void>>(new Map());

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/market-data`);

    ws.onopen = () => {
      console.log('[Market Data WS] Connected');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const message: MarketDataMessage = JSON.parse(event.data);
        
        // Map server message types to channel names
        const channelMap: Record<string, string> = {
          'trade': 'trades',
          'orderBook': 'l2Book',
          'candle': 'candle'
        };
        
        const channel = channelMap[message.type] || message.type;
        
        // Notify all listeners for this channel
        listenersRef.current.forEach((callback, key) => {
          if (key.startsWith(channel + ':')) {
            callback(message.data);
          }
        });
      } catch (error) {
        console.error('[Market Data WS] Parse error:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('[Market Data WS] Error:', error);
    };

    ws.onclose = () => {
      console.log('[Market Data WS] Disconnected');
      setIsConnected(false);
      wsRef.current = null;

      // Reconnect after 5 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 5000);
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  const subscribe = useCallback((type: 'trades' | 'l2Book' | 'candle', coin: string, interval?: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('[Market Data WS] Not connected, queuing subscription');
      return;
    }

    const message: any = { action: 'subscribe', type, coin };
    if (interval) message.interval = interval;

    wsRef.current.send(JSON.stringify(message));
    console.log(`[Market Data WS] Subscribed to ${type}:${coin}`);
  }, []);

  const unsubscribe = useCallback((type: 'trades' | 'l2Book' | 'candle', coin: string, interval?: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const message: any = { action: 'unsubscribe', type, coin };
    if (interval) message.interval = interval;

    wsRef.current.send(JSON.stringify(message));
    console.log(`[Market Data WS] Unsubscribed from ${type}:${coin}`);
  }, []);

  const addListener = useCallback((channel: string, coin: string, callback: (data: any) => void) => {
    const key = `${channel}:${coin}`;
    listenersRef.current.set(key, callback);
    return () => {
      listenersRef.current.delete(key);
    };
  }, []);

  return {
    isConnected,
    subscribe,
    unsubscribe,
    addListener,
  };
}
