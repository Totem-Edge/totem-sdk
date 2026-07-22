import { concatBytes, wotsVerifyDigest, hexToBytes } from '@totemsdk/core';
import {
  serializeTxDraft,
  omniaDraftToMinimaBytes,
  computeTxDraftDigest,
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

/**
 * Cooperative N-of-N factory close.
 *
 * Flow:
 *   1. Fail fast if `factory.fundingCoinId` is not set — settlement TX requires
 *      a concrete input coin.
 *   2. Build the settlement OmniaTxDraft (N outputs, one per participant with a
 *      positive allocation) spending the factory's N-of-N MULTISIG input.
 *   3. Compute the TX draft digest via `computeTxDraftDigest` from `@totemsdk/omnia`.
 *   4. Collect N-of-N signatures — all participants sign + verify the TX digest
 *      via the full WOTS lease cycle (reserve → sign → verify → commit).
 *   5. Encode the concatenated WOTS signatures as the settlement TX witness.
 *   6. When `chainProvider` is supplied: mine via `@totemsdk/txpow`'s `mineTxPoW`,
 *      assemble the full TxPoW blob, and broadcast.
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
  if (factory.status !== 'active') {
    throw new Error(`closeFactory requires factory status 'active', got '${factory.status}'`);
  }

  if (!factory.fundingCoinId) {
    throw new Error(
      'closeFactory requires factory.fundingCoinId to be set. ' +
      'Create the factory with fundingCoinIds + chainProvider so the funding TX is mined first.',
    );
  }

  if (factory.virtualChannels.length > 0) {
    const ids = factory.virtualChannels.map(vc => vc.channelId).join(', ');
    throw new Error(
      `closeFactory requires all virtual channels to be closed first. Open channels: ${ids}`,
    );
  }

  // ── Step 1: Validate all leaseProviders present ───────────────────────────
  for (const p of factory.participants) {
    if (!leaseProviders[p.partyId]) {
      throw new Error(`Missing WotsLeaseBundle for party '${p.partyId}' — closeFactory requires all N`);
    }
  }

  // ── Step 2: Build settlement TX ───────────────────────────────────────────
  const outputs: OmniaTxDraft['outputs'] = [];
  for (const participant of factory.participants) {
    const amount = factory.allocations[participant.partyId] ?? 0n;
    if (amount <= 0n) continue;
    outputs.push({
      address:        participant.settlementAddress ?? participant.publicKeyDigest,
      amount,
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
      amount:    factory.totalValue,
      tokenId:   factory.tokenId,
      scriptHex: factory.fundingScript,
    }],
    outputs,
    storeState:     true,
    stateVariables: [{ port: 100, value: true, type: 'bool' }],
  };

  const settlementTxHex = serializeTxDraft(settlementDraft);

  // ── Step 3: Collect N-of-N settlement signatures ──────────────────────────
  // All parties sign the TX draft digest — the canonical on-chain commitment.
  const txDigest = computeTxDraftDigest(settlementDraft);

  const witnessParts: Uint8Array[] = [];
  for (const p of factory.participants) {
    const bundle = leaseProviders[p.partyId];
    const reservation = await bundle.leaseProvider.reserveKeyUse({
      treeId:      `omnia-factory-${factory.factoryId}`,
      purpose:     'factory-settlement',
      payloadHash: Buffer.from(txDigest).toString('hex'),
    });

    let sig: Uint8Array;
    try {
      sig = await bundle.signer.sign(txDigest, reservation.indices);
    } catch (err) {
      await bundle.leaseProvider.burnReservation(reservation.reservationId, 'sign-failed').catch(() => {});
      throw err;
    }

    const verifyFn = bundle.verify
      ?? ((s: Uint8Array, c: Uint8Array, pkd: string) => wotsVerifyDigest(s, c, hexToBytes(pkd)));
    if (!verifyFn(sig, txDigest, p.publicKeyDigest)) {
      await bundle.leaseProvider.burnReservation(reservation.reservationId, 'verification-failed').catch(() => {});
      throw new Error(`Settlement signature verification failed for party '${p.partyId}'`);
    }

    await bundle.leaseProvider.commitKeyUse(
      reservation.reservationId,
      `factory-settlement-${factory.factoryId}`,
    );
    witnessParts.push(sig);
  }

  // Concatenated WOTS signatures form the N-of-N MULTISIG witness.
  const witnessBytes = witnessParts.reduce((a, b) => concatBytes(a, b));

  const payload: FactorySettlementPayload = {
    factoryId:        factory.factoryId,
    sequence:         factory.currentSequence,
    settlementTxHex,
    finalAllocations: { ...factory.allocations },
  };

  // ── Step 4: Mine + broadcast ──────────────────────────────────────────────
  if (chainProvider) {
    const draftBytes = omniaDraftToMinimaBytes(settlementDraft);
    const txBody     = serializeTxBody(draftBytes, witnessBytes);
    const mined      = await mineTxPoW(txBody, TX_POW_MIN_DIFFICULTY);
    const fullTxPoW  = concatBytes(concatBytes(mined.minedHeaderBytes, new Uint8Array([0x01])), txBody);
    await chainProvider.broadcastTxPoW(Buffer.from(fullTxPoW).toString('hex'));
    payload.txpowId  = Buffer.from(mined.txpowId).toString('hex');
  }

  return payload;
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
