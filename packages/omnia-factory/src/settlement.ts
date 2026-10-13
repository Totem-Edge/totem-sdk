import { concatBytes } from '@totemsdk/core/wasm';
import {
  serializeTxDraft,
  omniaDraftToMinimaBytes,
  computeTxDraftDigest,
  toRawMinima,
  verifyChannelSignature,
} from '@totemsdk/omnia';
import type { OmniaTxDraft } from '@totemsdk/omnia';
import { mineTxPoW, TX_POW_MIN_DIFFICULTY, serializeTxBody } from '@totemsdk/txpow';
import type { ChainStateProvider } from '@totemsdk/chain-provider';
import type {
  ChannelFactory,
  FactorySettlementPayload,
  FactoryDisputePayload,
  FactoryLogEntry,
  WotsLeaseBundle,
} from './types.js';

// ─── closeFactory ─────────────────────────────────────────────────────────────

/** Deterministic settlement TX material for a factory (RFC-035 B3). */
export interface FactorySettlementDraft {
  settlementDraft: OmniaTxDraft;
  settlementTxHex: string;
  txDigest: Uint8Array;
}

/** A participant's settlement signature, held until the close is confirmed. */
export interface FactorySettlementSignature {
  partyId: string;
  signature: Uint8Array;
  reservationId: string;
}

/**
 * Build the cooperative settlement TX + digest (no signing). Exported so peers
 * can independently rebuild and bind a proposal (RFC-035 B3).
 */
export function buildFactorySettlement(factory: ChannelFactory): FactorySettlementDraft {
  if (factory.status !== 'active') {
    throw new Error(`buildFactorySettlement requires factory status 'active', got '${factory.status}'`);
  }
  if (!factory.fundingCoinId) {
    throw new Error(
      'buildFactorySettlement requires factory.fundingCoinId to be set. ' +
      'Create the factory with fundingCoinIds + chainProvider so the funding TX is mined first.',
    );
  }
  if (factory.virtualChannels.length > 0) {
    const ids = factory.virtualChannels.map(vc => vc.channelId).join(', ');
    throw new Error(`closeFactory requires all virtual channels to be closed first. Open channels: ${ids}`);
  }

  const outputs: OmniaTxDraft['outputs'] = [];
  for (const participant of factory.participants) {
    const amount = factory.allocations[participant.partyId] ?? 0n;
    if (amount <= 0n) continue;
    outputs.push({
      address:        participant.settlementAddress ?? participant.publicKeyDigest,
      amount:         toRawMinima(amount, factory.tokenScale),
      tokenId:        factory.tokenId,
      storeState:     false,
      stateVariables: [],
    });
  }

  const settlementDraft: OmniaTxDraft = {
    type:    'settlement',
    inputs:  [{
      coinId:    factory.fundingCoinId,
      address:   factory.fundingAddress,
      amount:    toRawMinima(factory.totalValue, factory.tokenScale),
      tokenId:   factory.tokenId,
      scriptHex: factory.fundingScript,
    }],
    outputs,
    storeState:     true,
    stateVariables: [{ port: 100, value: true, type: 'bool' }],
  };

  return {
    settlementDraft,
    settlementTxHex: serializeTxDraft(settlementDraft),
    txDigest: computeTxDraftDigest(settlementDraft),
  };
}

/**
 * Produce this party's settlement signature WITHOUT committing the lease
 * (RFC-035 B3). The caller commits on `FACTORY_CLOSE_FINALIZED` or burns on expiry.
 */
export async function signFactorySettlement(
  factory: ChannelFactory,
  draft: FactorySettlementDraft,
  bundle: WotsLeaseBundle,
): Promise<FactorySettlementSignature> {
  const participant = factory.participants.find(
    p => p.publicKeyDigest === bundle.signer.publicKeyDigest,
  );
  if (!participant) {
    throw new Error('signer.publicKeyDigest does not match any registered factory participant');
  }

  const reservation = await bundle.leaseProvider.reserveKeyUse({
    treeId:      `omnia-factory-${factory.factoryId}`,
    purpose:     'factory-settlement',
    payloadHash: Buffer.from(draft.txDigest).toString('hex'),
  });

  let sig: Uint8Array;
  try {
    sig = await bundle.signer.sign(draft.txDigest, reservation.indices);
  } catch (err) {
    await bundle.leaseProvider.burnReservation(reservation.reservationId, 'sign-failed').catch(() => {});
    throw err;
  }

  const verifyFn = bundle.verify ?? verifyChannelSignature;
  if (!verifyFn(sig, draft.txDigest, participant.publicKeyDigest)) {
    await bundle.leaseProvider.burnReservation(reservation.reservationId, 'verification-failed').catch(() => {});
    throw new Error(`Settlement signature verification failed for party '${participant.partyId}'`);
  }

  return { partyId: participant.partyId, signature: sig, reservationId: reservation.reservationId };
}

/** Verify a remote settlement signature against a factory participant. */
export function verifyFactorySettlementSignature(
  factory: ChannelFactory,
  txDigest: Uint8Array,
  partyId: string,
  signature: Uint8Array,
  verify?: (sig: Uint8Array, digest: Uint8Array, pkd: string) => boolean,
): boolean {
  const participant = factory.participants.find(p => p.partyId === partyId);
  if (!participant) return false;
  const verifyFn = verify ?? verifyChannelSignature;
  try {
    return verifyFn(signature, txDigest, participant.publicKeyDigest);
  } catch {
    return false;
  }
}

/**
 * Assemble N-of-N settlement signatures into the MULTISIG witness + payload, and
 * (when a `chainProvider` is given) mine + broadcast the settlement TxPoW.
 */
export async function assembleFactorySettlement(
  factory: ChannelFactory,
  draft: FactorySettlementDraft,
  signatures: Record<string, FactorySettlementSignature>,
  chainProvider?: ChainStateProvider,
  options?: { verify?: (sig: Uint8Array, digest: Uint8Array, pkd: string) => boolean },
): Promise<FactorySettlementPayload> {
  const witnessParts: Uint8Array[] = [];
  for (const p of factory.participants) {
    const s = signatures[p.partyId];
    if (!s) throw new Error(`Missing settlement signature for party '${p.partyId}' — close requires all N`);
    if (!verifyFactorySettlementSignature(factory, draft.txDigest, p.partyId, s.signature, options?.verify)) {
      throw new Error(`Settlement signature verification failed for party '${p.partyId}'`);
    }
    witnessParts.push(s.signature);
  }

  const witnessBytes = witnessParts.reduce((a, b) => concatBytes(a, b));
  const payload: FactorySettlementPayload = {
    factoryId:        factory.factoryId,
    sequence:         factory.currentSequence,
    settlementTxHex:  draft.settlementTxHex,
    finalAllocations: { ...factory.allocations },
  };

  if (chainProvider) {
    const draftBytes = omniaDraftToMinimaBytes(draft.settlementDraft);
    const txBody     = serializeTxBody(draftBytes, witnessBytes);
    const mined      = await mineTxPoW(txBody, TX_POW_MIN_DIFFICULTY);
    const fullTxPoW  = concatBytes(concatBytes(mined.minedHeaderBytes, new Uint8Array([0x01])), txBody);
    await chainProvider.broadcastTxPoW(Buffer.from(fullTxPoW).toString('hex'));
    payload.txpowId  = Buffer.from(mined.txpowId).toString('hex');
  }

  return payload;
}

/**
 * Cooperative N-of-N factory close (central/local path).
 *
 * Builds the settlement TX, collects all N signatures (each committing its own
 * lease via the full WOTS cycle), assembles the witness, and — when a
 * `chainProvider` is supplied — mines + broadcasts the settlement TxPoW.
 *
 * @param factory        - Active factory with no open virtual channels.
 * @param leaseProviders - WOTS lease bundles for ALL N factory participants.
 * @param chainProvider  - Optional: mine + broadcast the settlement TX.
 */
export async function closeFactory(
  factory: ChannelFactory,
  leaseProviders: Record<string, WotsLeaseBundle>,
  chainProvider?: ChainStateProvider,
): Promise<FactorySettlementPayload> {
  for (const p of factory.participants) {
    if (!leaseProviders[p.partyId]) {
      throw new Error(`Missing WotsLeaseBundle for party '${p.partyId}' — closeFactory requires all N`);
    }
  }

  const draft = buildFactorySettlement(factory);
  const signatures: Record<string, FactorySettlementSignature> = {};
  for (const p of factory.participants) {
    const sig = await signFactorySettlement(factory, draft, leaseProviders[p.partyId]);
    await leaseProviders[p.partyId].leaseProvider.commitKeyUse(
      sig.reservationId,
      `factory-settlement-${factory.factoryId}`,
    );
    signatures[p.partyId] = sig;
  }

  return assembleFactorySettlement(factory, draft, signatures, chainProvider, {
    verify: (sig, digest, pkd) => {
      const participant = factory.participants.find(p => p.publicKeyDigest === pkd);
      const bundle = participant ? leaseProviders[participant.partyId] : undefined;
      const fn = bundle?.verify ?? verifyChannelSignature;
      return fn(sig, digest, pkd);
    },
  });
}

// ─── buildDisputePayload ──────────────────────────────────────────────────────

/**
 * Build a unilateral factory close (dispute) payload.
 *
 * Includes the full `stateLog` (with monotonically increasing `sequence` entries)
 * for on-chain or arbitration verification.  Virtual channels still open at
 * dispute time are included by ID so the dispute resolver can adjudicate their
 * balances independently.
 */
export function buildDisputePayload(
  factory: ChannelFactory,
  evidence: string,
): FactoryDisputePayload {
  const logEntry: FactoryLogEntry = {
    sequence:          factory.currentSequence,
    timestamp:         Date.now(),
    event:             'dispute',
    allocations:       { ...factory.allocations },
    virtualChannelIds: factory.virtualChannels.map(vc => vc.channelId),
  };

  return {
    factoryId:         factory.factoryId,
    latestSequence:    factory.currentSequence,
    fundingTxId:       factory.fundingTxId ?? '',
    allocations:       { ...factory.allocations },
    virtualChannelIds: factory.virtualChannels.map(vc => vc.channelId),
    stateLog:          [...factory.stateLog, logEntry],
    evidence,
  };
}
