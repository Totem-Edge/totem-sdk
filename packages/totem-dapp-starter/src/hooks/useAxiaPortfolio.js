/**
 * useAxiaPortfolio — fetch balance and token holdings from the Axia API.
 *
 * Balance data comes from the Axia API (via your backend proxy), NOT from
 * wallet events or TOTEM_GET_ACCOUNTS. This is the v4.1 pattern.
 *
 * @param {string|null} address  — connected Minima address (Mx... format)
 * @param {object}      options
 * @param {number}      options.pollIntervalMs — auto-refresh interval in ms (0 = disabled)
 *
 * @returns {{ portfolio, loading, error, refresh }}
 *
 * Usage:
 *   const { portfolio, loading } = useAxiaPortfolio(address, { pollIntervalMs: 30000 });
 *   // portfolio.minimaBalance, portfolio.tokens, portfolio.utxoCount, portfolio.supplyShare
 */
import { useState, useEffect, useCallback } from 'react';
import { track } from '@totem/observability';

export function useAxiaPortfolio(address, { pollIntervalMs = 0 } = {}) {
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchPortfolio = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    const start = Date.now();
    try {
      const res = await fetch(`/api/portfolio/${address}`);
      if (!res.ok) {
        throw new Error(`Portfolio fetch failed: ${res.status} ${res.statusText}`);
      }
      const json = await res.json();
      const data = json.data ?? json;
      setPortfolio(data);
      setError(null);
      try {
        track({
          kind: 'portfolio_fetch',
          outcome: 'ok',
          latency_ms: Date.now() - start,
        });
      } catch {}
    } catch (err) {
      setError(err.message);
      try {
        track({
          kind: 'portfolio_fetch',
          outcome: 'error',
          latency_ms: Date.now() - start,
          error_class: 'fetch',
        });
      } catch {}
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    if (!address) {
      setPortfolio(null);
      setError(null);
      return;
    }

    fetchPortfolio();

    if (pollIntervalMs > 0) {
      const id = setInterval(fetchPortfolio, pollIntervalMs);
      return () => clearInterval(id);
    }
  }, [fetchPortfolio, address, pollIntervalMs]);

  return { portfolio, loading, error, refresh: fetchPortfolio };
}
