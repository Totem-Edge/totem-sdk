import type { OmniaChannel, ChannelParticipant } from '@totemsdk/omnia';
import { wotsVerifyDigest, fromHex } from '@totemsdk/core';
import type { ChannelFactory, FactoryLogEntry, WotsLeaseBundle } from './types.js';
import { enforceConservation } from './factory.js';
import { computeFactoryStateCommitment } from './commitment.js';

// ─── Internal helpers ─────────────────────────────────────────────────────────

function generateChannelId(factoryId: string, partyAId: string, partyBId: string): string {
  const nonce = Array.from(
    globalThis.crypto?.getRandomValues?.(new Uint8Array(8)) ?? new Uint8Array(8),
  ).map(b => b.toString(16).padStart(2, '0')).join('');
  return `vc-${factoryId.slice(0, 8)}-${partyAId}-${partyBId}-${nonce}`;
}

/** Run the WOTS lease cycle for one party and verify the produced signature. */
async function leaseSign(
  factoryId: string,
  commitment: Uint8Array,
  purpose: string,
  partyId: string,
  publicKeyDigest: string,
  bundle: WotsLeaseBundle,
): Promise<void> {
  const reservation = await bundle.leaseProvider.reserveKeyUse({
    treeId:      `omnia-factory-${factoryId}`,
    purpose,
    payloadHash: Buffer.from(commitment).toString('hex'),
  });

  let sig: Uint8Array;
  try {
    sig = await bundle.signer.sign(commitment, reservation.indices);
  } catch (err) {
    await bundle.leaseProvider.burnReservation(reservation.reservationId, 'sign-failed').catch(() => {});
    throw err;
  }

  const verifyFn = bundle.verify
    ?? ((s: Uint8Array, c: Uint8Array, pkd: string) => wotsVerifyDigest(s, c, fromHex(pkd)));
  if (!verifyFn(sig, commitment, publicKeyDigest)) {
    await bundle.leaseProvider.burnReservation(reservation.reservationId, 'verification-failed').catch(() => {});
    throw new Error(
      `Signature verification failed for party '${partyId}' — aborting virtual channel operation`,
    );
  }

  await bundle.leaseProvider.commitKeyUse(reservation.reservationId, `factory-vc-${factoryId}`);
}

/**
 * Collect N-of-N signatures from all factory participants for a state commitment.
 * Commitment is bound to `newSequence` (the post-commit sequence) for replay resistance.
 */
async function collectNofN(
  factoryId: string,
  commitment: Uint8Array,
  purpose: string,
  participants: Array<{ partyId: string; publicKeyDigest: string }>,
  leaseProviders: Record<string, WotsLeaseBundle>,
): Promise<void> {
  for (const p of participants) {
    if (!leaseProviders[p.partyId]) {
      throw new Error(
        `Missing WotsLeaseBundle for party '${p.partyId}' — all N participants must provide one`,
      );
    }
  }
  for (const p of participants) {
    await leaseSign(factoryId, commitment, purpose, p.partyId, p.publicKeyDigest, leaseProviders[p.partyId]);
  }
}

// ─── openVirtualChannel ───────────────────────────────────────────────────────

/**
 * Open a virtual channel between two factory participants.
 *
 * ALL N factory participants must agree (N-of-N WOTS signature collection)
 * before the virtual channel is committed and allocations deducted. This ensures
 * the shared factory UTXO's off-chain state is consistent and dispute-provable.
 *
 * The commitment is bound to `currentSequence + 1` — the post-commit sequence —
 * preventing replay of the same openVC commitment against a future factory state.
 *
 * The returned `OmniaChannel` has `channelType: 'virtual'` and `factoryRef` set.
 * Its `fundingTxId`/`fundingCoinId` reference the factory's shared UTXO.
 * It is ready for off-chain state updates via `@totemsdk/omnia` primitives
 * (`updateState`, `addHTLC`, `signState`, etc.).
 *
 * @param factory        - Active factory.
 * @param parties        - Tuple `[partyAId, partyBId]` of the two channel parties.
 * @param amounts        - Capacity per party: `Record<partyId, bigint>`.
 * @param leaseProviders - WOTS lease bundles for ALL N factory participants.
 * @param channelId      - Optional explicit channel ID; auto-generated if omitted.
 */
export async function openVirtualChannel(
  factory: ChannelFactory,
  parties: [string, string],
  amounts: Record<string, bigint>,
  leaseProviders: Record<string, WotsLeaseBundle>,
  channelId?: string,
): Promise<{ factory: ChannelFactory; channel: OmniaChannel }> {
  if (factory.status !== 'active') {
    throw new Error(`openVirtualChannel requires factory status 'active', got '${factory.status}'`);
  }

  const [partyAId, partyBId] = parties;
  const amountA = amounts[partyAId] ?? 0n;
  const amountB = amounts[partyBId] ?? 0n;

  if (amountA < 0n || amountB < 0n) {
    throw new Error('Virtual channel amounts must be non-negative');
  }
  if (amountA + amountB === 0n) {
    throw new Error('Virtual channel must have positive total value');
  }

  const partyAMeta = factory.participants.find(p => p.partyId === partyAId);
  const partyBMeta = factory.participants.find(p => p.partyId === partyBId);
  if (!partyAMeta) throw new Error(`Party '${partyAId}' not found in factory`);
  if (!partyBMeta) throw new Error(`Party '${partyBId}' not found in factory`);

  const allocA = factory.allocations[partyAId] ?? 0n;
  const allocB = factory.allocations[partyBId] ?? 0n;
  if (allocA < amountA) {
    throw new Error(`Party '${partyAId}' has insufficient allocation: ${allocA} < ${amountA}`);
  }
  if (allocB < amountB) {
    throw new Error(`Party '${partyBId}' has insufficient allocation: ${allocB} < ${amountB}`);
  }

  const vcId        = channelId ?? generateChannelId(factory.factoryId, partyAId, partyBId);
  const newSequence = factory.currentSequence + 1;

  const newAllocations: Record<string, bigint> = {
    ...factory.allocations,
    [partyAId]: allocA - amountA,
    [partyBId]: allocB - amountB,
  };
  const newVcIds = [...factory.virtualChannels.map(vc => vc.channelId), vcId];

  const commitment = computeFactoryStateCommitment(
    factory.factoryId,
    newSequence,
    newAllocations,
    newVcIds,
  );

  await collectNofN(
    factory.factoryId,
    commitment,
    'factory-vc-open',
    factory.participants,
    leaseProviders,
  );

  const now = Date.now();

  const partyA: ChannelParticipant = {
    partyId:           partyAId,
    publicKeyDigest:   partyAMeta.publicKeyDigest,
    addressIndex:      partyAMeta.addressIndex,
    settlementAddress: partyAMeta.settlementAddress,
  };
  const partyB: ChannelParticipant = {
    partyId:           partyBId,
    publicKeyDigest:   partyBMeta.publicKeyDigest,
    addressIndex:      partyBMeta.addressIndex,
    settlementAddress: partyBMeta.settlementAddress,
  };

  // Construct the virtual OmniaChannel — no new on-chain TX.
  // The channel shares the factory's UTXO; its channelType marks it virtual.
  const channel: OmniaChannel = {
    channelId:       vcId,
    fundingTxId:     factory.fundingTxId ?? '',
    fundingCoinId:   factory.fundingCoinId ?? '',
    fundingScript:   factory.fundingScript,
    fundingAddress:  factory.fundingAddress,
    tokenId:         factory.tokenId,
    tokenScale:      0,
    totalValue:      amountA + amountB,
    parties:         [partyA, partyB],
    balances:        { [partyAId]: amountA, [partyBId]: amountB },
    pendingHTLCs:    [],
    currentSequence: 0,
    latestState:     null,
    stateLog:        [],
    status:          'active',
    channelType:     'virtual',
    factoryRef:      factory.factoryId,
    createdAt:       now,
    updatedAt:       now,
  };

  const logEntry: FactoryLogEntry = {
    sequence:          newSequence,
    timestamp:         now,
    event:             'virtual_open',
    allocations:       newAllocations,
    virtualChannelIds: newVcIds,
  };

  const updated: ChannelFactory = {
    ...factory,
    allocations:     newAllocations,
    virtualChannels: [...factory.virtualChannels, channel],
    currentSequence: newSequence,
    stateLog:        [...factory.stateLog, logEntry],
  };

  enforceConservation(updated);
  return { factory: updated, channel };
}

// ─── closeVirtualChannel ─────────────────────────────────────────────────────

/**
 * Close a virtual channel and return its final balances to factory allocations.
 *
 * ALL N factory participants must agree (N-of-N WOTS signature collection).
 * The commitment is bound to `currentSequence + 1`.
 *
 * Final balances are taken from `channel.latestState.balances` (the last agreed
 * off-chain state from `@totemsdk/omnia`'s state machine) or fall back to
 * `channel.balances` (the initial opening split) if no state updates have occurred.
 *
 * No on-chain TX is needed: the factory's shared UTXO remains intact.
 *
 * @param factory        - Active factory.
 * @param channel        - The virtual `OmniaChannel` to close (with `latestState` set if updated).
 * @param leaseProviders - WOTS lease bundles for ALL N factory participants.
 */
export async function closeVirtualChannel(
  factory: ChannelFactory,
  channel: OmniaChannel,
  leaseProviders: Record<string, WotsLeaseBundle>,
): Promise<ChannelFactory> {
  const existing = factory.virtualChannels.find(c => c.channelId === channel.channelId);
  if (!existing) throw new Error(`Virtual channel '${channel.channelId}' not found in factory`);

  // Use latest agreed state's balances; fall back to initial balances.
  const finalAllocations: Record<string, bigint> =
    channel.latestState?.balances ?? { ...channel.balances };

  const finalSum = Object.values(finalAllocations).reduce((a, b) => a + b, 0n);
  if (finalSum !== channel.totalValue) {
    throw new Error(
      `Final balance sum (${finalSum}) !== channel totalValue (${channel.totalValue})`,
    );
  }

  const newSequence = factory.currentSequence + 1;

  const newAllocations: Record<string, bigint> = { ...factory.allocations };
  for (const [partyId, amount] of Object.entries(finalAllocations)) {
    newAllocations[partyId] = (newAllocations[partyId] ?? 0n) + amount;
  }

  const remainingVcIds = factory.virtualChannels
    .filter(c => c.channelId !== channel.channelId)
    .map(c => c.channelId);

  const commitment = computeFactoryStateCommitment(
    factory.factoryId,
    newSequence,
    newAllocations,
    remainingVcIds,
  );

  await collectNofN(
    factory.factoryId,
    commitment,
    'factory-vc-close',
    factory.participants,
    leaseProviders,
  );

  const logEntry: FactoryLogEntry = {
    sequence:          newSequence,
    timestamp:         Date.now(),
    event:             'virtual_close',
    allocations:       newAllocations,
    virtualChannelIds: remainingVcIds,
  };

  const updated: ChannelFactory = {
    ...factory,
    allocations:     newAllocations,
    virtualChannels: factory.virtualChannels.filter(c => c.channelId !== channel.channelId),
    currentSequence: newSequence,
    stateLog:        [...factory.stateLog, logEntry],
  };

  enforceConservation(updated);
  return updated;
}
