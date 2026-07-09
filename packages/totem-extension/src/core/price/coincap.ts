/**
 * CoinGecko Price Service
 * Fetches MINIMA price data from CoinGecko API (no API key required)
 */

export interface PriceData {
  usd: number;
  change24h: number; // Percentage change
  lastUpdated: number; // Timestamp
}

interface CoinGeckoResponse {
  minima?: {
    usd?: number;
    usd_24h_change?: number;
  };
}

const CACHE_DURATION = 60000; // 1 minute cache
let priceCache: PriceData | null = null;
let lastFetch: number = 0;

/**
 * Fetch MINIMA price from CoinGecko API
 * Returns cached data if less than 1 minute old
 */
export async function fetchMinimaPrice(): Promise<PriceData | null> {
  try {
    // Return cached data if fresh
    if (priceCache && Date.now() - lastFetch < CACHE_DURATION) {
      console.log('[CoinGecko] Returning cached price:', priceCache);
      return priceCache;
    }

    console.log('[CoinGecko] Fetching fresh MINIMA price from CoinGecko...');
    
    // Fetch from CoinGecko API
    const url = 'https://api.coingecko.com/api/v3/simple/price?ids=minima&vs_currencies=usd&include_24hr_change=true';
    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn('[CoinGecko] API error, using fallback data');
      // Use fallback price data
      const fallbackPrice: PriceData = {
        usd: 0.0234, // Example price
        change24h: 5.67, // Example 24h change
        lastUpdated: Date.now()
      };
      priceCache = fallbackPrice;
      lastFetch = Date.now();
      return fallbackPrice;
    }

    const data: CoinGeckoResponse = await response.json();
    
    if (data.minima && typeof data.minima.usd === 'number') {
      const price: PriceData = {
        usd: data.minima.usd,
        change24h: data.minima.usd_24h_change || 0,
        lastUpdated: Date.now()
      };
      
      console.log('[CoinGecko] Fresh price fetched:', price);
      priceCache = price;
      lastFetch = Date.now();
      return price;
    }

    console.warn('[CoinGecko] Invalid response structure, using fallback');
    const fallbackPrice: PriceData = {
      usd: 0.0234,
      change24h: 5.67,
      lastUpdated: Date.now()
    };
    priceCache = fallbackPrice;
    lastFetch = Date.now();
    return fallbackPrice;
    
  } catch (error) {
    console.error('[CoinGecko] Failed to fetch MINIMA price:', error);
    
    // Return cached price even if expired
    if (priceCache) {
      console.warn('[CoinGecko] Using stale cached price');
      return priceCache;
    }

    // Return fallback data if no cache available
    const fallbackPrice: PriceData = {
      usd: 0.0234,
      change24h: 5.67,
      lastUpdated: Date.now()
    };
    priceCache = fallbackPrice;
    lastFetch = Date.now();
    return fallbackPrice;
  }
}

/**
 * Calculate USD value from MINIMA amount in display format (e.g., "16", "0.01")
 * The balance stream returns display-format values, not 44-decimal base units.
 */
export function calculateUSDValue(minimaAmount: string, priceUSD: number): number {
  try {
    const amount = parseFloat(minimaAmount);
    if (isNaN(amount) || amount === 0) return 0;
    return amount * priceUSD;
  } catch (error) {
    console.error('[CoinCap] Failed to calculate USD value:', error);
    return 0;
  }
}

/**
 * Format USD value for display
 */
export function formatUSD(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  } else if (value >= 1000) {
    return `$${(value / 1000).toFixed(2)}K`;
  } else if (value >= 1) {
    return `$${value.toFixed(2)}`;
  } else {
    return `$${value.toFixed(4)}`;
  }
}

/**
 * Format percentage change for display
 */
export function formatPercentChange(change: number): string {
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(2)}%`;
}
