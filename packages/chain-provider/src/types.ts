/**
 * @totemsdk/chain-provider — shared types and ChainStateProvider interface
 */

export interface CoinsQuery {
  address?: string;
  tokenId?: string;
  sendable?: boolean;
  relevant?: boolean;
  coinId?: string;
  megammr?: boolean;
}

export interface Coin {
  coinid: string;
  amount: string;
  address: string;
  miniaddress?: string;
  tokenid: string;
  token?: unknown;
  storestate?: boolean;
  state?: unknown[];
  spent?: boolean;
  mmrentry?: string;
  created?: string;
}

export interface MMRProof {
  coinid: string;
  data: unknown;
}

export interface ChainTip {
  block: number;
  hash: string;
  time?: string;
}

export interface TokenInfo {
  tokenid: string;
  name: Record<string, unknown>;
  total?: string;
  confirmed?: string;
  sendable?: string;
  coins?: number;
  script?: string;
  description?: unknown;
}

export interface TokenSearchQuery {
  name?: string;
  category?: string[];
  creatorAddress?: string;
  limit?: number;
  offset?: number;
}

export interface BroadcastResult {
  txpowid?: string;
  success: boolean;
  message?: string;
}

/**
 * Inputs for a live deposit-funding check. "Verified" here means a check against
 * on-chain truth (unspent coin owned by the LP for the claimed token+amount) —
 * never a declared string on a record.
 */
export interface VerifyDepositParams {
  /** Coin spendable as the funding source. */
  coinId: string;
  /** Address that must own the coin (Mx form; 0x-hex roots are normalized against). */
  ownerAddress: string;
  /** Required token ID; omit to accept base MINIMA. */
  tokenId?: string;
  /** Claimed funding amount (decimal string); coin.amount must be >= this. */
  claimedAmount?: string;
  /** When true, only chain-confirmed coins pass (mmrentry != '0'). */
  requireConfirmed?: boolean;
}

/** Granular result of a deposit-funding check. `valid` is the all-gates AND. */
export interface DepositVerification {
  valid: boolean;
  exists: boolean;
  /** Coin exists and is not spent (on-chain confirm, not declared). */
  unspent: boolean;
  /** Coin is confirmed on-chain (not a mempool entry). */
  confirmed: boolean;
  /** Coin address equals the claimed owner (Mx or 0x-root form). */
  ownedByOwner: boolean;
  /** Coin tokenid matches the requested token (or base token when none given). */
  tokenMatches: boolean;
  /** Coin amount covers the claimed amount. */
  amountSufficient: boolean;
  reason?: string;
  /** The coin as observed on-chain. */
  coin?: Coin;
  error?: unknown;
}

/**
 * A chunk-based MMR proof (legacy Minima shape), i.e. the sibling hashes
 * between a leaf and the root. Matches `@totemsdk/core` `MMRProof`.
 */
export interface MmrChunkProof {
  chunks: Array<{
    isLeft: boolean;
    mmrData: { data: Uint8Array; value: bigint };
  }>;
}

/** Address-derivation policy for LP funding deposits. */
export interface DepositAddressOptions {
  poolId?: string;
  tokenId?: string;
}

/**
 * Optional funding-truth extension port. Providers that can attest deposits
 * implement this; `withDepositVerifier(provider)` provides a default that uses
 * the base provider's `getCoin` for the live path.
 */
export interface DepositVerifier {
  verifyDeposit(params: VerifyDepositParams): Promise<DepositVerification>;
  /** Deterministic deposit address the LP funds the pool/channel from. */
  depositAddressFor(lp: string, opts?: DepositAddressOptions): string;
  /** Chain MMR root for offline proof verification; null when unavailable. */
  getMmrRoot(): Promise<string | null>;
  /** Offline (root-anchored) proof check; falls back to the live path when absent. */
  verifyMmrDeposit?(params: {
    leafPubkey: Uint8Array;
    proof: MmrChunkProof;
    expectedRoot: Uint8Array;
  }): Promise<boolean>;
}

export interface ChainStateProvider {
  getCoins(query: CoinsQuery): Promise<Coin[]>;
  getCoin(coinId: string): Promise<Coin | null>;
  getProof(coinId: string): Promise<MMRProof>;
  getTip(): Promise<ChainTip>;
  getToken(tokenId: string): Promise<TokenInfo>;
  searchTokens(query: TokenSearchQuery): Promise<TokenInfo[]>;
  getTokensByCreator(address: string): Promise<TokenInfo[]>;
  broadcastTxPoW(txpowHex: string): Promise<BroadcastResult>;
}
