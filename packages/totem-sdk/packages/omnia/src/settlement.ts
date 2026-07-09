import { concatBytes } from '@totemsdk/core';
import { mineTxPoW, TX_POW_MIN_DIFFICULTY, serializeTxBody } from '@totemsdk/txpow';
import type { ChainStateProvider } from '@totemsdk/chain-provider';
import type { WotsLeaseProvider } from '@totemsdk/wots-lease';
import type { SigningIndices } from '@totemsdk/wots-lease';
import type {
  OmniaChannel,
  SignedChannelState,
  SettlementPayload,
  DisputePayload,
  ChannelSigner,
  ChannelSignature,
} from './types.js';
import { ChannelStatusError } from './errors.js';
import { buildSettlementTx, serializeTxDraft, omniaDraftToMinimaBytes } from './transactions.js';
import { signTxDraft } from './sign.js';

export interface ProposeSettlementOptions {
  /** Explicit signer — falls back to channel.localSigner when not provided. */
  signer?: ChannelSigner;
  /**
   * Per-party settlement output addresses.
   * Falls back to `party.settlementAddress` for each party when not provided.
   * If neither is available, throws an error.
   */
  partyAddresses?: Record<string, string>;
  /**
   * Chain provider for TxPoW mining and broadcast.
   * When provided, the settlement TX is mined (SHA3-256 PoW) and broadcast
   * to the Minima network via `chainProvider.broadcastTxPoW`. The mined
   * TxPoW ID is returned as `settlementPayload.txpowId`.
   * When omitted, the payload is built and signed off-chain only (useful
   * for cooperative multi-sig flows where the counterparty broadcasts).
   */
  chainProvider?: ChainStateProvider;
}

/**
 * Minimal witness encoding for eltoo settlement TX.
 * Packs the signing indices (addressIndex, l1, l2) followed by raw WOTS signature bytes.
 * In a full Minima integration this would be a Minima Witness with InputScriptInfo
 * and CoinProof, serialized via @totemsdk/core's Streamable. This encoding carries
 * the same data and is sufficient for the TxPoW body passed to serializeTxBody.
 */
function encodeSettlementWitness(signature: ChannelSignature, indices: SigningIndices): Uint8Array {
  const meta = new Uint8Array(8);
  const view = new DataView(meta.buffer);
  view.setUint32(0, indices.addressIndex, false);
  view.setUint16(4, indices.l1, false);
  view.setUint16(6, indices.l2, false);
  return concatBytes(meta, signature);
}

/**
 * Builds the cooperative settlement TX (`STATE(100)=TRUE`) and signs it with the
 * settlement TX digest — critical for on-chain correctness.
 *
 * Full chain path (when `opts.chainProvider` is provided):
 *   1. Build settlement draft (STATE(100)=TRUE, per-party outputs).
 *   2. Sign the settlement TX digest via the WOTS lease.
 *   3. Serialize draft bytes + witness bytes → `serializeTxBody()` (txpow TxBody).
 *   4. Mine PoW via `mineTxPoW()` using `TX_POW_MIN_DIFFICULTY`.
 *   5. Assemble full TxPoW: `minedHeaderBytes || 0x01 || txBody`.
 *   6. Broadcast via `chainProvider.broadcastTxPoW()`.
 *
 * Spec: `proposeSettlement(channel, leaseProvider)` — signer and partyAddresses are
 * optional via the opts argument and fall back to channel fields.
 */
export async function proposeSettlement(
  channel: OmniaChannel,
  leaseProvider: WotsLeaseProvider,
  opts?: ProposeSettlementOptions,
): Promise<{ settlementPayload: SettlementPayload; partialState: Partial<SignedChannelState> }> {
  if (!['active', 'closing_mutual'].includes(channel.status)) {
    throw new ChannelStatusError(['active', 'closing_mutual'], channel.status);
  }

  const effectiveSigner = opts?.signer ?? channel.localSigner;
  if (!effectiveSigner) throw new Error('No signer provided and channel.localSigner is not set');

  const signerParty = channel.parties.find(p => p.publicKeyDigest === effectiveSigner.publicKeyDigest);
  if (!signerParty) throw new Error('Signer is not a channel participant');

  // Derive settlement addresses: use explicit override, then party.settlementAddress.
  const partyAddresses: Record<string, string> = {};
  for (const party of channel.parties) {
    const addr = opts?.partyAddresses?.[party.partyId] ?? party.settlementAddress;
    if (!addr) {
      throw new Error(
        `No settlement address for party ${party.partyId}. ` +
        `Set party.settlementAddress or pass opts.partyAddresses.`
      );
    }
    partyAddresses[party.partyId] = addr;
  }

  const state = channel.latestState ?? {
    sequence: channel.currentSequence,
    balances: channel.balances,
    pendingHTLCs: channel.pendingHTLCs,
    stateVariables: [
      { port: 100, value: false, type: 'bool' as const },
      { port: 101, value: BigInt(channel.currentSequence), type: 'number' as const },
    ],
    transactionHex: '',
    signatures: {},
    signingIndices: {},
  };

  const settlementDraft = buildSettlementTx(channel, state, partyAddresses);
  const settlementHex = serializeTxDraft(settlementDraft);

  // signTxDraft signs the settlement TX (STATE(100)=TRUE), not the update TX.
  const { signature, indices } = await signTxDraft(
    channel,
    settlementDraft,
    `settlement-seq-${state.sequence}`,
    leaseProvider,
    effectiveSigner,
  );

  const htlcOutputs = state.pendingHTLCs
    .filter(h => h.status === 'pending')
    .map(h => ({
      htlcId: h.htlcId,
      amount: h.amount,
      htlcTxHex: '',
    }));

  const settlementPayload: SettlementPayload = {
    channelId: channel.channelId,
    sequence: state.sequence,
    settlementTxHex: settlementHex,
    balances: { ...state.balances },
    htlcOutputs,
  };

  // ── Full TxPoW mining + chain broadcast ──────────────────────────────────
  // When chainProvider is supplied, produce a chain-ready TxPoW:
  //   omniaDraftToMinimaBytes() → canonical Minima TX bytes (via @totemsdk/core serializeTransaction)
  //   + witness → serializeTxBody → mineTxPoW
  //   → concat(minedHeader, 0x01, txBody) → broadcastTxPoW
  if (opts?.chainProvider) {
    const draftBytes = omniaDraftToMinimaBytes(settlementDraft);
    const witnessBytes = encodeSettlementWitness(signature, indices);
    const txBody = serializeTxBody(draftBytes, witnessBytes);

    const mined = await mineTxPoW(txBody, TX_POW_MIN_DIFFICULTY);

    // Full TxPoW = TxHeader bytes + MiniByte(0x01=hasBody) + TxBody bytes
    const fullTxPoW = concatBytes(mined.minedHeaderBytes, new Uint8Array([0x01]), txBody);
    await opts.chainProvider.broadcastTxPoW(Buffer.from(fullTxPoW).toString('hex'));

    settlementPayload.txpowId = Buffer.from(mined.txpowId).toString('hex');
  }

  const partialState: Partial<SignedChannelState> = {
    sequence: state.sequence,
    balances: state.balances,
    pendingHTLCs: state.pendingHTLCs,
    stateVariables: [
      { port: 100, value: true, type: 'bool' },
      { port: 101, value: BigInt(state.sequence), type: 'number' },
    ],
    transactionHex: settlementHex,
    signatures: { [signerParty.partyId]: signature },
    signingIndices: { [signerParty.partyId]: indices },
  };

  return { settlementPayload, partialState };
}

export function buildDisputePayload(
  channel: OmniaChannel,
  evidence?: string,
): DisputePayload {
  const latest = channel.latestState;
  if (!latest) {
    throw new Error('Cannot build dispute payload: no signed state available');
  }

  return {
    channelId: channel.channelId,
    latestSequence: latest.sequence,
    updateTxHex: latest.transactionHex,
    stateLog: channel.stateLog,
    evidence: evidence ?? JSON.stringify(latest.stateVariables),
  };
}

export function markChannelClosing(
  channel: OmniaChannel,
  mode: 'mutual' | 'unilateral',
): OmniaChannel {
  return {
    ...channel,
    status: mode === 'mutual' ? 'closing_mutual' : 'closing_unilateral',
    updatedAt: Date.now(),
  };
}

export function markChannelClosed(channel: OmniaChannel): OmniaChannel {
  return {
    ...channel,
    status: 'closed',
    updatedAt: Date.now(),
    stateLog: [
      ...channel.stateLog,
      {
        sequence: channel.currentSequence,
        timestamp: Date.now(),
        balances: { ...channel.balances },
        htlcCount: 0,
        event: 'settle',
      },
    ],
  };
}
