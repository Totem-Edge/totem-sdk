import type { ChainStateProvider, ChainTip } from '@totemsdk/chain-provider';
import { MinimaRpcProvider } from '@totemsdk/chain-provider';
import { createMinimaRpcClient, type MinimaRpcClient } from '@totemsdk/minima-rpc';

export interface TotemNodeAdapterOptions {
  host: string;
  port: number;
  password?: string;
  ssl?: boolean;
  pollIntervalMs?: number;
  provider?: ChainStateProvider;
  client?: MinimaRpcClient;
}

export interface ConfirmationOptions {
  timeoutMs?: number;
  pollIntervalMs?: number;
  minConfirmations?: number;
}

export interface TotemNodeAdapter extends ChainStateProvider {
  getMode(): Promise<string | undefined>;
  /**
   * Sign arbitrary data with a wallet key (`sign publickey:<0x> data:<0x>`).
   * Used to produce the funding witness signature: createChannel builds the
   * funding digest, and this signs it with the funding coin's key.
   */
  signData(pubkeyHex: string, dataHex: string): Promise<string>;
  waitForConfirmation(coinId: string, options?: ConfirmationOptions): Promise<void>;
  subscribe(listener: (tip: ChainTip) => void): () => void;
  close(): void;
}

export function createTotemNodeAdapter(options: TotemNodeAdapterOptions): TotemNodeAdapter {
  const client = options.client ?? createMinimaRpcClient({
    host: options.host,
    port: options.port,
    password: options.password,
    ssl: options.ssl ?? false,
  });
  const provider = options.provider ?? new MinimaRpcProvider(client);
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

    async signData(pubkeyHex: string, dataHex: string): Promise<string> {
      const result = await client.runCommand('sign', { publickey: pubkeyHex, data: dataHex });
      const unwrap = (v: unknown): string | undefined => {
        if (typeof v === 'string') return v;
        if (v && typeof v === 'object' && typeof (v as { response?: unknown }).response === 'string') {
          return (v as { response: string }).response;
        }
        return undefined;
      };
      const sig = unwrap(result) ?? unwrap((result as { response?: unknown } | undefined)?.response);
      if (!sig) throw new Error('signData: unexpected node response');
      return sig;
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
