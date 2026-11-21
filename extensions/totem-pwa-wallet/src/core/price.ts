/**
 * MINIMA spot price — same source the extension uses.
 *
 * CoinGecko's public endpoint, cached for a minute so opening the wallet does
 * not burn the free quota. A failed fetch returns null and the UI simply omits
 * the fiat line; it never invents a price.
 */

export interface PriceData {
  usd: number;
  change24h?: number;
  lastUpdated: number;
}

const CACHE_MS = 60_000;
const ENDPOINT =
  'https://api.coingecko.com/api/v3/simple/price?ids=minima&vs_currencies=usd&include_24hr_change=true';

let cache: PriceData | null = null;
let lastFetch = 0;

export async function fetchMinimaPrice(): Promise<PriceData | null> {
  if (cache && Date.now() - lastFetch < CACHE_MS) return cache;
  try {
    const response = await fetch(ENDPOINT);
    if (!response.ok) return cache;
    const data = await response.json();
    const usd = data?.minima?.usd;
    if (typeof usd !== 'number' || !Number.isFinite(usd)) return cache;

    cache = {
      usd,
      change24h:
        typeof data?.minima?.usd_24h_change === 'number'
          ? data.minima.usd_24h_change
          : undefined,
      lastUpdated: Date.now(),
    };
    lastFetch = Date.now();
    return cache;
  } catch {
    return cache;
  }
}

/** MINIMA amount × USD price, or 0 when either side is unusable. */
export function calculateUsdValue(minimaAmount: string, priceUsd: number): number {
  const amount = Number(minimaAmount);
  if (!Number.isFinite(amount) || amount === 0) return 0;
  return amount * priceUsd;
}

/**
 * USD amount, matching the extension's formatter:
 *   ≥ $1M → $1.23M, ≥ $1K → $1.23K, ≥ $1 → $1.23,
 *   below $1 → four decimals so the 3rd/4th places are visible ($0.0031).
 */
export function formatUsd(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '$0.00';
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
  if (value >= 1) return `$${value.toFixed(2)}`;
  return `$${value.toFixed(4)}`;
}
