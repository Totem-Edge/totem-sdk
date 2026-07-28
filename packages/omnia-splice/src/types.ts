import type { WotsLeaseProvider, SigningIndices } from '@totemsdk/wots-lease';
import type { OmniaChannel, ChannelSigner, SignedChannelState } from '@totemsdk/omnia';

export type { OmniaChannel, ChannelSigner, SignedChannelState };
export type { WotsLeaseProvider, SigningIndices };

export type WotsSignature = Uint8Array;

export type SpliceType = 'splice_in' | 'splice_out';

export interface SpliceParams {
  type: SpliceType;
  newTotalValue: bigint;
  newBalances: Record<string, bigint>;
  additionalCoinId?: string;
  additionalCoinAddress?: string;
  additionalAmount?: bigint;
  withdrawAmount?: bigint;
  withdrawAddress?: string;
  extraOutputs?: Array<{ address: string; amount: bigint; tokenId?: string }>;
}

export interface SpliceTxInput {
  coinId: string;
  address: string;
  amount: bigint;
  tokenId: string;
}

export interface SpliceTxOutput {
  address: string;
  amount: bigint;
  tokenId: string;
  storeState: boolean;
  stateVarSettlement: boolean;
  stateVarSequence: number;
}

export interface SpliceTxDraft {
  inputs: SpliceTxInput[];
  outputs: SpliceTxOutput[];
  channelId: string;
  params: SpliceParams;
}

/**
 * Splice proposal produced by the initiating party.
 *
 * `spliceTxHex` contains the canonical Minima TX bytes (hex) that both parties
 * independently verify before signing. `spliceTxDraft` retains the structured
 * representation needed for digest computation and output inspection by the
 * acceptor; it is NOT sent over the wire in production but is included here for
 * the v0.1.0 in-process protocol. Future relay integration will transmit only
 * `spliceTxHex` + `params`.
 *
 * `proposerReservationId` and `proposerSigningIndices` carry the WOTS lease
 * reservation used when producing `proposerSignature`. They are consumed by
 * `finalizeSplice` to commit or burn the reservation after the splice TX is
 * settled, preserving key-slot accounting and preventing one-time-key reuse.
 */
export interface SpliceProposal {
  spliceId: string;
  channelId: string;
  params: SpliceParams;
  spliceTxHex: string;
  spliceTxDraft: SpliceTxDraft;
  proposerPublicKeyDigest: string;
  proposerSignature: WotsSignature;
  proposerReservationId: string;
  proposerSigningIndices: SigningIndices;
  proposedAt: number;
}

/**
 * `acceptorReservationId` and `acceptorSigningIndices` carry the WOTS lease
 * reservation used when producing `acceptorSignature`. Consumed by
 * `finalizeSplice` to commit or burn the acceptor's key-slot reservation.
 */
export interface SpliceAcceptance {
  spliceId: string;
  channelId: string;
  acceptorPublicKeyDigest: string;
  acceptorSignature: WotsSignature;
  acceptorReservationId: string;
  acceptorSigningIndices: SigningIndices;
  acceptedAt: number;
}

/**
 * A channel returned by `quiesceChannel`.
 *
 * - `status: 'quiesced'` — no new HTLCs may be added until the splice confirms.
 * - `pendingHTLCs: []` — all resolved HTLCs are cleared from the active list.
 * - `quiesceSignedState` — the local party's partial signed state over the
 *   final pre-splice balance split (sequence incremented by one). Exchange this
 *   with the counterparty to obtain their co-signature before finalizing the splice.
 */
export type QuiescedChannel = Omit<OmniaChannel, 'status'> & {
  status: 'quiesced';
  quiesceSignedState: Partial<SignedChannelState>;
};

/**
 * A channel returned by `finalizeSplice`.
 *
 * Extends OmniaChannel with splice provenance fields. The returned channel is
 * immediately usable for new payments: `status: 'active'`, `currentSequence: 0`,
 * fresh WOTS budget. `splicedFrom` identifies the old channel and
 * `spliceFundingCoinId` is the new on-chain UTXO.
 *
 * **Mutation side effect**: `finalizeSplice` mutates the `channel` argument
 * (the `QuiescedChannel` passed in) by setting `status: 'spliced'` after the
 * splice TX is confirmed. This invalidates the old channel in-place; the
 * returned `SplicedChannel` (status: 'active') is the only valid live channel.
 */
export type SplicedChannel = OmniaChannel & {
  splicedFrom: string;
  spliceType: SpliceType;
  spliceFundingTxId: string;
  spliceFundingCoinId: string;
};

export interface SpliceLeaseProvider {
  /** Local party's WOTS signer. */
  signer: ChannelSigner;
  /** WOTS lease provider for key slot reservation/commit (required for quiesceChannel). */
  wotsLease: WotsLeaseProvider;
  /** Optional function to broadcast the mined splice TxPoW to the chain. */
  broadcast?: (txHex: string) => Promise<{ txpowid?: string; success?: boolean }>;
}

export interface SpliceSigningIndices {
  l1: number;
  l2: number;
  addressIndex: number;
}
