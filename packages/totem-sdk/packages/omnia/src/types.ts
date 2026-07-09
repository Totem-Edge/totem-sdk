import type { SigningIndices } from '@totemsdk/wots-lease';
import type { PaymentIntent, AgentPolicy, AgentReceipt } from '@totemsdk/agent-policy';

export type { PaymentIntent, AgentPolicy, AgentReceipt };

/** Flat WOTS signature bytes — output of wotsSign(). */
export type ChannelSignature = Uint8Array;

export type partyId = string;

export type ChannelStatus =
  | 'opening'
  | 'active'
  | 'closing_mutual'
  | 'closing_unilateral'
  | 'disputing'
  | 'closed'
  | 'spliced';

export type CapacityWarning = 'approaching' | 'critical';

export interface ChannelParticipant {
  partyId: string;
  publicKeyDigest: string;
  addressIndex: number;
  /** Address to receive funds on cooperative settlement. Derived from publicKeyDigest when not set. */
  settlementAddress?: string;
  relayEndpoint?: string;
}

export interface HTLCRecord {
  htlcId: string;
  amount: bigint;
  hashlock: string;
  timeoutBlock: bigint;
  direction: 'offered' | 'received';
  status: 'pending' | 'fulfilled' | 'timed_out';
  htlcAddress: string;
  senderPublicKeyDigest: string;
  recipientPublicKeyDigest: string;
}

export interface StateValue {
  port: number;
  value: string | bigint | boolean;
  type: 'bool' | 'number' | 'hex' | 'string';
}

export interface SignedChannelState {
  sequence: number;
  balances: Record<partyId, bigint>;
  pendingHTLCs: HTLCRecord[];
  stateVariables: StateValue[];
  transactionHex: string;
  signatures: Record<partyId, ChannelSignature>;
  signingIndices: Record<partyId, SigningIndices>;
}

export interface ChannelLogEntry {
  sequence: number;
  timestamp: number;
  balances: Record<partyId, bigint>;
  htlcCount: number;
  event: 'update' | 'htlc_add' | 'htlc_fulfill' | 'htlc_timeout' | 'open' | 'settle';
}

export interface ChannelWatermark {
  channelId: string;
  addressIndex: number;
  nextL1: number;
  nextL2: number;
  totalUsed: number;
}

export interface OmniaChannel {
  channelId: string;
  fundingTxId: string;
  fundingCoinId: string;
  fundingScript: string;
  /** SHA3-256 script-hash address for the eltoo script — used as input/output address in update/settlement TXs. */
  fundingAddress: string;
  tokenId: string;
  /**
   * Scale factor for coloured coins: `tokenAmount = minimaRawAmount × 10^tokenScale`.
   * For native Minima (tokenId=0x00) this is always 0.
   * Balances are stored in scaled token units; TX builders convert to raw Minima.
   */
  tokenScale: number;
  totalValue: bigint;
  parties: ChannelParticipant[];
  balances: Record<partyId, bigint>;
  pendingHTLCs: HTLCRecord[];
  currentSequence: number;
  latestState: SignedChannelState | null;
  stateLog: ChannelLogEntry[];
  status: ChannelStatus;
  channelType: 'direct' | 'virtual';
  factoryRef?: string;
  /**
   * Local party signer — stored on the channel so callers can omit the signer param from
   * public functions (updateState, addHTLC, proposeSettlement, executeIntent, etc.).
   * Explicit signer params always take precedence over this field.
   */
  localSigner?: ChannelSigner;
  /**
   * Tracks the most recent in-flight proposal at a given sequence number.
   * Used for double-sign detection: same sequence + different payload → DoubleSignError.
   */
  pendingProposal?: { sequence: number; payloadHash: string };
  /**
   * The coin ID of the most recently confirmed on-chain channel output.
   * Starts as `fundingCoinId`; callers should update this after each mined
   * update TX is confirmed on-chain so subsequent update/settlement inputs
   * reference the real spendable coin rather than the funding output.
   */
  latestCoinId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ChannelReceipt {
  channelId: string;
  sequence: number;
  balances: Record<partyId, bigint>;
  capacityWarning?: CapacityWarning;
  capacityUsed: number;
  capacityTotal: number;
  timestamp: number;
}

export interface CreateChannelParams {
  localParty: ChannelParticipant;
  remoteParty: ChannelParticipant;
  localAmount: bigint;
  remoteAmount: bigint;
  tokenId?: string;
  /** Scale factor for coloured coins. 0 = native Minima. Default: 0. */
  tokenScale?: number;
  fundingCoinId: string;
  channelType?: 'direct' | 'virtual';
  factoryRef?: string;
}

export interface ChannelProposal {
  channelId: string;
  localParty: ChannelParticipant;
  remoteParty: ChannelParticipant;
  localAmount: bigint;
  remoteAmount: bigint;
  tokenId: string;
  tokenScale?: number;
  fundingScript: string;
  fundingAddress?: string;
  fundingTxId: string;
  fundingCoinId: string;
}

export interface AddHTLCParams {
  amount: bigint;
  hashlock: string;
  timeoutBlock: bigint;
  direction: 'offered' | 'received';
  counterpartPublicKeyDigest: string;
}

export interface SettlementPayload {
  channelId: string;
  sequence: number;
  settlementTxHex: string;
  balances: Record<partyId, bigint>;
  htlcOutputs: HTLCOutputRecord[];
  /** SHA3-256 TxPoW ID (hex) from mineTxPoW — populated when proposeSettlement is given a chainProvider. */
  txpowId?: string;
}

export interface HTLCOutputRecord {
  htlcId: string;
  amount: bigint;
  htlcTxHex: string;
}

export interface DisputePayload {
  channelId: string;
  latestSequence: number;
  updateTxHex: string;
  stateLog: ChannelLogEntry[];
  evidence: string;
}

export interface OmniaTxDraft {
  type: 'funding' | 'update' | 'settlement';
  inputs: TxInputDraft[];
  outputs: TxOutputDraft[];
  storeState: boolean;
  stateVariables: StateValue[];
}

export interface TxInputDraft {
  coinId: string;
  address: string;
  amount: bigint;
  tokenId: string;
  scriptHex: string;
}

export interface TxOutputDraft {
  address: string;
  amount: bigint;
  tokenId: string;
  storeState: boolean;
  stateVariables: StateValue[];
}

export interface ChannelSigner {
  publicKeyDigest: string;
  /** Returns flat WOTS signature bytes (output of wotsSign). */
  sign(payload: Uint8Array, indices: SigningIndices): Promise<ChannelSignature>;
}

export interface KissvmEvaluator {
  evaluate(script: string, stateVariables: StateValue[]): Promise<{ result: boolean; error?: string }>;
}

export interface VerifyStateOptions {
  kissvm?: KissvmEvaluator;
}

export interface UpdateDelta {
  newBalances: Record<partyId, bigint>;
  memo?: string;
}

/**
 * Return type of `updateState`.
 *
 * Normal case: `{ channel, signedState }`.
 * Near-exhaustion case (≥95% of 4096 WOTS slots used): `{ channel, signedState, error: 'CAPACITY_NEAR_EXHAUSTION' }`.
 * At 100% `updateState` throws `ChannelCapacityError` instead.
 *
 * The `channel` field is always present to allow callers to inspect the unchanged
 * channel object even when the update was blocked.
 */
export interface UpdateStateResult {
  channel: OmniaChannel;
  signedState: Partial<SignedChannelState>;
  error?: 'CAPACITY_NEAR_EXHAUSTION';
}

export interface IntentResult {
  status: 'approved' | 'pending_user' | 'rejected';
  receipt?: AgentReceipt;
  channel?: OmniaChannel;
}
