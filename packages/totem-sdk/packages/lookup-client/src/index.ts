export { LookupClient } from './client.js';
export { LookupClientProvider } from './provider.js';
export { LookupClientError } from './rpc.js';
export { FrameParser, createInMemoryPair } from './transport.js';
export type {
  ITransport,
  LookupClientConfig,
  CoinUpdateEvent,
  CoinUpdateCallback,
  Unsubscribe,
} from './types.js';

import { LookupClient } from './client.js';
import { createHyperswarmTransport } from './transport.js';
import type { LookupClientConfig } from './types.js';

/**
 * Create and connect a LookupClient to a personal lookup node.
 *
 * @example
 * ```ts
 * // P2P via Hyperswarm (Pear/Bare/Node)
 * const client = await connectLookupNode({ hyperswarmTopic: 'deadbeef...' });
 * const coins = await client.getCoins({ address: '0xMx...' });
 *
 * // Subscribe to real-time coin updates
 * const unsub = client.subscribeCoinUpdates(ev => console.log('coin event', ev));
 * await client.watchAddress('0xMx...');
 *
 * // Clean up
 * unsub();
 * client.disconnect();
 * ```
 */
export async function connectLookupNode(config: LookupClientConfig): Promise<LookupClient> {
  const transport = config._transport ?? (await createHyperswarmTransport(config));
  const client = new LookupClient(config);
  await client._connect(transport);
  return client;
}
