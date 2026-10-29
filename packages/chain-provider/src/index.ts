export type {
  ChainStateProvider,
  CoinsQuery,
  Coin,
  MMRProof,
  ChainTip,
  TokenInfo,
  TokenSearchQuery,
  BroadcastResult,
  VerifyDepositParams,
  DepositVerification,
  MmrChunkProof,
  DepositAddressOptions,
  DepositVerifier,
} from './types.js';

export {
  DEPOSIT_ADDRESS_DOMAIN,
  depositAddressFor,
  verifyDeposit,
  verifyDepositMmrProof,
  withDepositVerifier,
} from './verify-deposit.js';

export { HostedProvider } from './providers/hosted.js';
export type { HostedProviderConfig } from './providers/hosted.js';

export { MinimaRpcProvider } from './providers/minima-rpc.js';

export { LookupClientProvider } from './providers/lookup-client.js';
export type { LookupClientLike } from './providers/lookup-client.js';

export { CompositeProvider } from './providers/composite.js';

export {
  resolveChainProvider,
  parseMinimaRpcUrl,
  assertConsentedNodeUrl,
  isSelfHosted,
} from './resolve.js';
export type {
  ChainProviderMode,
  ChainProviderConfig,
  HostedRelayConfig,
  ResolveChainProviderOptions,
  ParsedMinimaRpcUrl,
} from './resolve.js';

// Raw command-level client for transaction assembly (RFC-073). The typed
// ChainStateProvider covers reads; transaction backends also need the node's
// command surface (`coinexport`, `txnimport`, `txnpost`, `sendtransaction`).
export { createMinimaRpcClient } from '@totemsdk/minima-rpc';
export type { MinimaRpcClient } from '@totemsdk/minima-rpc';
