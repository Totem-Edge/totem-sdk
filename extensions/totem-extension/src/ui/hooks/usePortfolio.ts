/**
 * usePortfolio Hook
 *
 * React hook for consuming real-time portfolio updates via the background
 * service worker's 'portfolio-stream' port.
 *
 * Replaces the legacy useBalanceStream hook.
 *
 * Returns PortfolioEntry[] (flat list, all asset kinds) plus a loading status.
 *
 * Usage:
 *   const { entries, status } = usePortfolio();
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { PortfolioEntry, ConnectionState } from '@totemsdk/realtime';

export type PortfolioStatus = 'loading' | 'live' | 'cached' | 'error';

export interface UsePortfolioResult {
  entries: PortfolioEntry[];
  status: PortfolioStatus;
  connectionState: ConnectionState;
  error: string | undefined;
  startStream: (addresses: string[]) => void;
  stopStream: () => void;
  updateAddresses: (addresses: string[]) => void;
}

export function usePortfolio(): UsePortfolioResult {
  const [entries, setEntries] = useState<PortfolioEntry[]>([]);
  const [status, setStatus] = useState<PortfolioStatus>('loading');
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [error, setError] = useState<string | undefined>();

  const portRef = useRef<chrome.runtime.Port | null>(null);
  const addressesRef = useRef<string[]>([]);

  const connect = useCallback(() => {
    if (portRef.current) return;

    try {
      const port = chrome.runtime.connect({ name: 'portfolio-stream' });
      portRef.current = port;

      port.onMessage.addListener((msg) => {
        switch (msg.type) {
          case 'CONNECTION_STATE':
            setConnectionState(msg.payload.state);
            setError(msg.payload.error);
            if (msg.payload.state === 'connected' || msg.payload.state === 'fallback') {
              setStatus(msg.payload.state === 'connected' ? 'live' : 'cached');
            } else if (msg.payload.state === 'error') {
              setStatus('error');
            }
            break;

          case 'PORTFOLIO_SNAPSHOT': {
            const incomingEntries: PortfolioEntry[] = msg.payload.entries ?? [];
            setEntries(prev => {
              const address: string = incomingEntries[0]?.address ?? (msg.payload as any).address ?? '';
              if (!address) return incomingEntries;
              const unrelated = prev.filter(e => e.address !== address);
              return [...unrelated, ...incomingEntries];
            });
            setStatus('live');
            setError(undefined);
            break;
          }

          case 'INITIAL_SNAPSHOT': {
            const incomingEntries: PortfolioEntry[] = msg.payload.entries ?? [];
            if (incomingEntries.length > 0) {
              setEntries(incomingEntries);
              setStatus('cached');
            }
            setConnectionState(msg.payload.connectionState ?? 'connecting');
            break;
          }

          case 'TX_CONFIRMATION':
            break;
        }
      });

      port.onDisconnect.addListener(() => {
        portRef.current = null;
        setConnectionState('disconnected');
      });
    } catch (e: any) {
      console.error('[usePortfolio] Failed to connect port:', e);
      setError(e.message || 'Failed to connect');
      setStatus('error');
    }
  }, []);

  const startStream = useCallback((addresses: string[]) => {
    addressesRef.current = addresses;
    if (!portRef.current) connect();
    portRef.current?.postMessage({ type: 'START_STREAM', addresses });
  }, [connect]);

  const stopStream = useCallback(() => {
    portRef.current?.postMessage({ type: 'STOP_STREAM' });
  }, []);

  const updateAddresses = useCallback((addresses: string[]) => {
    addressesRef.current = addresses;
    portRef.current?.postMessage({ type: 'UPDATE_ADDRESSES', addresses });
  }, []);

  useEffect(() => {
    return () => {
      if (portRef.current) {
        portRef.current.disconnect();
        portRef.current = null;
      }
    };
  }, []);

  return { entries, status, connectionState, error, startStream, stopStream, updateAddresses };
}

export type { PortfolioEntry };
