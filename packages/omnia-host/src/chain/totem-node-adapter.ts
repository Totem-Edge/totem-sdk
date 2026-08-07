import type { ChainStateProvider, ChainTip } from '@totemsdk/chain-provider';
import { PureMinimaRpcProvider } from '@totemsdk/chain-provider';
import { createPureMinimaClient, type PureMinimaClient } from '@totemsdk/pureminima-rpc';

export interface TotemNodeAdapterOptions {
  host: string;
  port: number;
  password?: string;
  ssl?: boolean;
  pollIntervalMs?: number;
  provider?: ChainStateProvider;
  client?: PureMinimaClient;
}

export interface ConfirmationOptions {
  timeoutMs?: number;
  pollIntervalMs?: number;
  minConfirmations?: number;
}

export interface TotemNodeAdapter extends ChainStateProvider {
  getMode(): Promise<string | undefined>;
  waitForConfirmation(coinId: string, options?: ConfirmationOptions): Promise<void>;
  subscribe(listener: (tip: ChainTip) => void): () => void;
  close(): void;
}

export function createTotemNodeAdapter(options: TotemNodeAdapterOptions): TotemNodeAdapter {
  const client = options.client ?? createPureMinimaClient({
    host: options.host,
    port: options.port,
    password: options.password,
    ssl: options.ssl ?? false,
  });
  const provider = options.provider ?? new PureMinimaRpcProvider(client);
  const listeners = new Set<(tip: ChainTip) => void>();
  const pollIntervalMs = options.pollIntervalMs ?? 5_000;
  let timer: NodeJS.Timeout | undefined;
  let stopped = false;

  async function poll(): Promise<void> {
    if (stopped || listeners.size === 0) return;
    try {
      const tip = await provider.getTip();
      for (const listener of listeners) listener(tip);
    } finally {
      if (!stopped && listeners.size > 0) timer = setTimeout(() => void poll(), pollIntervalMs);
    }
  }

  return {
    getCoins: (query) => provider.getCoins(query),
    getCoin: (coinId) => provider.getCoin(coinId),
    getProof: (coinId) => provider.getProof(coinId),
    getTip: () => provider.getTip(),
    getToken: (tokenId) => provider.getToken(tokenId),
    searchTokens: (query) => provider.searchTokens(query),
    getTokensByCreator: (address) => provider.getTokensByCreator(address),
    broadcastTxPoW: (txpowHex) => provider.broadcastTxPoW(txpowHex),

    async getMode(): Promise<string | undefined> {
      const result = await client.runCommand('getmode');
      if (!result || typeof result !== 'object') return undefined;
      const mode = (result as { mode?: unknown }).mode;
      return typeof mode === 'string' ? mode : undefined;
    },

    async waitForConfirmation(coinId, confirmationOptions = {}): Promise<void> {
      const timeoutMs = confirmationOptions.timeoutMs ?? 120_000;
      const interval = confirmationOptions.pollIntervalMs ?? pollIntervalMs;
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        const coin = await provider.getCoin(coinId);
        if (coin && !coin.spent) return;
        await new Promise((resolve) => setTimeout(resolve, interval));
      }
      throw new Error(`Timed out waiting for coin confirmation: ${coinId}`);
    },

    subscribe(listener) {
      listeners.add(listener);
      if (listeners.size === 1) void poll();
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && timer) {
          clearTimeout(timer);
          timer = undefined;
        }
      };
    },

    close() {
      stopped = true;
      listeners.clear();
      if (timer) clearTimeout(timer);
    },
  };
}
