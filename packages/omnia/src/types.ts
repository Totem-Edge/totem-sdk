import type { SigningIndices } from '@totemsdk/wots-lease';
import type { PaymentIntent, AgentPolicy, AgentReceipt } from '@totemsdk/agent-policy';

export type { PaymentIntent, AgentPolicy, AgentReceipt };

/**
 * Serialized WOTS channel signature. Canonically a serialized hierarchical
 * `TreeSignature` (`serializeTreeSignature`) — the wallet's unified WOTS scheme
 * (RFC-037). Legacy flat `wotsSign` output (1088 bytes) is still accepted during
 * the RFC-037 migration (see `verifyChannelSignature`).
 */
export type ChannelSignature = Uint8Array;

export type partyId = string;

export type ChannelStatus =
  | 'opening'
  | 'funding_pending'
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
  /**
   * Root-identity anchor (RFC-037 Amendment A). Optional during migration; when
   * present, the participant's channel key is bound to a wallet root identity via
   * an ownership proof. Verified by `verifyChannelParticipantIdentity`.
   */
  identity?: ChannelIdentity;
}

/**
 * Structural mirror of `@totemsdk/root-identity`'s `OwnershipProof` (RFC-037-A).
 * Kept structural so `@totemsdk/omnia` does not depend on the identity packages.
 */
export interface ChannelOwnershipProof {
  rootAddress: string;
  rootPublicKey: string;
  childAddresses: string[];
  childPublicKeys: string[];
  rootProof: {
    address: string;
    publicKey: string;
    signature: string;
    message: string;
  };
  timestamp: string;
}

/** Wallet root-identity anchor for a channel participant (RFC-037-A). */
export interface ChannelIdentity {
  /** `@totemsdk/identity` id (`totem:id:person:<hex>`). */
  id: string;
  rootAddress: string;
  rootPublicKey: string;
  ownershipProof: ChannelOwnershipProof;
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
  closePackage?: SignedClosePackage;
  programTransition?: ProgramTransition;
}

export interface ClosePackageArtifact {
  txHex: string;
  txDigest: string;
  signatures: Record<partyId, ChannelSignature>;
  signingIndices: Record<partyId, SigningIndices>;
}

export interface SignedClosePackage {
  version: 1;
  channelId: string;
  sequence: number;
  stateCommitmentV2: string;
  update: ClosePackageArtifact;
  settlement: ClosePackageArtifact;
}

export interface UnilateralCloseState {
  channelId: string;
  sequence: number;
  updateTxHex: string;
  settlementTxHex: string;
  contestStartBlock: number;
  contestDeadlineBlock: number;
  status: 'update_broadcast' | 'settlement_broadcast';
  updateTxpowId?: string;
  settlementTxpowId?: string;
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
  programId: string;
  programVersion: number;
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
  /**
   * Sequence number of the channel coin currently committed on-chain (the
   * funding output, or the output of the most recent broadcast update tx).
   * Off-chain updates do not change it. The eltoo settlement branch requires
   * `SEQUENCE EQ PREVSEQUENCE`, so cooperative settlement must use this value
   * (with the agreed balances) rather than `currentSequence`.
   */
  onChainSequence?: number;
  latestState: SignedChannelState | null;
  stateLog: ChannelLogEntry[];
  status: ChannelStatus;
  channelType: 'direct' | 'virtual';
  /** Eltoo contest window embedded in the funding script (default 256). */
  contestDelayBlocks?: number;
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
  unilateralClose?: UnilateralCloseState;
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
  /** Serialized Minima witness for the funding transaction input(s). Required for createChannel broadcast. */
  fundingWitnessBytes?: Uint8Array;
  /**
   * Alternative to `fundingWitnessBytes`: the funding input proofs (serialized
   * Minima CoinProof + ScriptProof). Used with `fundingSigner` so createChannel
   * assembles the witness itself.
   */
  fundingProofs?: {
    coinProofs: Uint8Array[];
    scriptProofs: Uint8Array[];
  };
  /**
   * The Minima (KISSVM) script whose hash is the funding coin's address. When
   * set (and `fundingWitnessBytes` is absent) createChannel builds the required
   * single-leaf `ScriptProof` itself via `buildScriptProof` and appends it to
   * the witness. The node requires a ScriptProof for every input address, so
   * callers that only have the address script should pass it here instead of
   * hand-rolling `fundingProofs.scriptProofs`.
   */
  fundingScript?: string;
  /**
   * Sign the funding transaction digest (WOTS). Called only when
   * `fundingWitnessBytes` is absent. Lets a wallet sign the exact digest
   * createChannel built, without the caller reproducing the funding draft.
   */
  fundingSigner?: (digest: Uint8Array) => Promise<Uint8Array> | Uint8Array;
  channelType?: 'direct' | 'virtual';
  factoryRef?: string;
  program?: ChannelProgram;
  /**
   * Blocks the counterparty must wait before a settlement spend is valid
   * (eltoo contest window). Defaults to 256. Short values are for test/dev
   * networks only — a short window weakens unilateral-close protection.
   */
  contestDelayBlocks?: number;
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
  programId?: string;
  programVersion?: number;
  fundingAddress?: string;
  fundingTxId: string;
  fundingCoinId: string;
  /** Eltoo contest window embedded in the funding script (default 256). */
  contestDelayBlocks?: number;
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

export interface UnilateralCloseStartResult {
  channel: OmniaChannel;
  disputePayload: DisputePayload;
  contestStartBlock: number;
  contestDeadlineBlock: number;
  updateTxpowId?: string;
}

export interface UnilateralCloseFinalizeResult {
  channel: OmniaChannel;
  settlementPayload: SettlementPayload;
}

export interface OmniaTxDraft {
  type: 'funding' | 'update' | 'settlement';
  inputs: TxInputDraft[];
  outputs: TxOutputDraft[];
  storeState: boolean;
  stateVariables: StateValue[];
}

export interface ChannelProgramBuildStateInput {
  channel: OmniaChannel;
  sequence: number;
  balances: Record<partyId, bigint>;
  pendingHTLCs: HTLCRecord[];
  settlement: boolean;
  previousState?: SignedChannelState | null;
  transition?: ProgramTransition;
}

export interface ChannelProgramValidationResult {
  valid: boolean;
  error?: string;
}

export interface ChannelProgramValidateTransitionInput {
  channel: OmniaChannel;
  previousState?: SignedChannelState | null;
  nextState: SignedChannelState;
  transition?: ProgramTransition;
}

export interface ChannelProgram {
  id: string;
  version: number;
  /**
   * Build the channel script. `contestDelayBlocks` is only honoured by programs
   * that embed an eltoo-style contest delay (the default eltoo program); other
   * programs may ignore it.
   */
  buildScript(parties: ChannelParticipant[], options?: { contestDelayBlocks?: number }): string;
  buildStateVariables(input: ChannelProgramBuildStateInput): StateValue[];
  validateTransition?(input: ChannelProgramValidateTransitionInput): ChannelProgramValidationResult;
}

export interface ProgramTransition {
  action: string;
  inputs?: Record<string, string | bigint | boolean>;
  witness?: Record<string, string>;
  metadata?: Record<string, string>;
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
  /** Returns the WOTS signature over `payload` for the given indices (RFC-037:
   *  serialized hierarchical TreeSignature). */
  sign(payload: Uint8Array, indices: SigningIndices): Promise<ChannelSignature>;
}

export interface VerifyStateOptions {
  kissvm?: boolean | import('./kissvm.js').KissvmValidationOptions;
}

export interface UpdateDelta {
  newBalances: Record<partyId, bigint>;
  memo?: string;
  programTransition?: ProgramTransition;
}

export interface ApplyProgramTransitionParams {
  transition: ProgramTransition;
  balances?: Record<partyId, bigint>;
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
  /** True when a stable operation ID was already committed. */
  idempotentReplay?: boolean;
}
