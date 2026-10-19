import { DefaultEltooPaymentProgram, verifyChannelSignature, type OmniaChannel, type ChannelParticipant } from '@totemsdk/omnia';
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

  const verifyFn = bundle.verify ?? verifyChannelSignature;
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
/** Deterministic virtual-channel open plan (RFC-035 B3). */
export interface VirtualChannelOpenPlan {
  vcId: string;
  parties: [string, string];
  amounts: Record<string, bigint>;
  newSequence: number;
  newAllocations: Record<string, bigint>;
  newVcIds: string[];
  commitment: Uint8Array;
}

/** A participant's VC-open signature, held until the open is confirmed. */
export interface VirtualChannelOpenSignature {
  partyId: string;
  signature: Uint8Array;
  reservationId: string;
}

/** Validate + build the VC-open plan (no signing). Exported so peers can bind. */
export function buildVirtualChannelOpen(
  factory: ChannelFactory,
  parties: [string, string],
  amounts: Record<string, bigint>,
  channelId?: string,
): VirtualChannelOpenPlan {
  if (factory.status !== 'active') {
    throw new Error(`openVirtualChannel requires factory status 'active', got '${factory.status}'`);
  }
  const [partyAId, partyBId] = parties;
  const amountA = amounts[partyAId] ?? 0n;
  const amountB = amounts[partyBId] ?? 0n;
  if (amountA < 0n || amountB < 0n) throw new Error('Virtual channel amounts must be non-negative');
  if (amountA + amountB === 0n) throw new Error('Virtual channel must have positive total value');

  const partyAMeta = factory.participants.find(p => p.partyId === partyAId);
  const partyBMeta = factory.participants.find(p => p.partyId === partyBId);
  if (!partyAMeta) throw new Error(`Party '${partyAId}' not found in factory`);
  if (!partyBMeta) throw new Error(`Party '${partyBId}' not found in factory`);

  const allocA = factory.allocations[partyAId] ?? 0n;
  const allocB = factory.allocations[partyBId] ?? 0n;
  if (allocA < amountA) throw new Error(`Party '${partyAId}' has insufficient allocation: ${allocA} < ${amountA}`);
  if (allocB < amountB) throw new Error(`Party '${partyBId}' has insufficient allocation: ${allocB} < ${amountB}`);

  const vcId = channelId ?? generateChannelId(factory.factoryId, partyAId, partyBId);
  const newSequence = factory.currentSequence + 1;
  const newAllocations: Record<string, bigint> = {
    ...factory.allocations,
    [partyAId]: allocA - amountA,
    [partyBId]: allocB - amountB,
  };
  const newVcIds = [...factory.virtualChannels.map(vc => vc.channelId), vcId];
  const commitment = computeFactoryStateCommitment(factory.factoryId, newSequence, newAllocations, newVcIds);

  return {
    vcId,
    parties,
    amounts: { [partyAId]: amountA, [partyBId]: amountB },
    newSequence,
    newAllocations,
    newVcIds,
    commitment,
  };
}

/**
 * Produce this party's VC-open signature WITHOUT committing the lease
 * (RFC-035 B3). The caller commits on `VC_FINALIZED` or burns on expiry.
 */
export async function signVirtualChannelOpen(
  factory: ChannelFactory,
  plan: VirtualChannelOpenPlan,
  bundle: WotsLeaseBundle,
): Promise<VirtualChannelOpenSignature> {
  const participant = factory.participants.find(
    p => p.publicKeyDigest === bundle.signer.publicKeyDigest,
  );
  if (!participant) {
    throw new Error('signer.publicKeyDigest does not match any registered factory participant');
  }
  const reservation = await bundle.leaseProvider.reserveKeyUse({
    treeId:      `omnia-factory-${factory.factoryId}`,
    purpose:     'factory-vc-open',
    payloadHash: Buffer.from(plan.commitment).toString('hex'),
  });
  let sig: Uint8Array;
  try {
    sig = await bundle.signer.sign(plan.commitment, reservation.indices);
  } catch (err) {
    await bundle.leaseProvider.burnReservation(reservation.reservationId, 'sign-failed').catch(() => {});
    throw err;
  }
  const verifyFn = bundle.verify ?? verifyChannelSignature;
  if (!verifyFn(sig, plan.commitment, participant.publicKeyDigest)) {
    await bundle.leaseProvider.burnReservation(reservation.reservationId, 'verification-failed').catch(() => {});
    throw new Error(`Virtual-channel signature verification failed for party '${participant.partyId}'`);
  }
  return { partyId: participant.partyId, signature: sig, reservationId: reservation.reservationId };
}

export function verifyVirtualChannelOpenSignature(
  factory: ChannelFactory,
  commitment: Uint8Array,
  partyId: string,
  signature: Uint8Array,
  verify?: (sig: Uint8Array, digest: Uint8Array, pkd: string) => boolean,
): boolean {
  const participant = factory.participants.find(p => p.partyId === partyId);
  if (!participant) return false;
  const verifyFn = verify ?? verifyChannelSignature;
  try {
    return verifyFn(signature, commitment, participant.publicKeyDigest);
  } catch {
    return false;
  }
}

/**
 * Assemble N-of-N VC-open signatures into the updated factory + virtual channel.
 */
export function assembleVirtualChannelOpen(
  factory: ChannelFactory,
  plan: VirtualChannelOpenPlan,
  signatures: Record<string, VirtualChannelOpenSignature>,
  verify?: (sig: Uint8Array, digest: Uint8Array, pkd: string) => boolean,
): { factory: ChannelFactory; channel: OmniaChannel } {
  for (const p of factory.participants) {
    const s = signatures[p.partyId];
    if (!s) throw new Error(`Missing virtual-channel signature for party '${p.partyId}' — open requires all N`);
    if (!verifyVirtualChannelOpenSignature(factory, plan.commitment, p.partyId, s.signature, verify)) {
      throw new Error(`Virtual-channel signature verification failed for party '${p.partyId}'`);
    }
  }

  const [partyAId, partyBId] = plan.parties;
  const partyAMeta = factory.participants.find(p => p.partyId === partyAId)!;
  const partyBMeta = factory.participants.find(p => p.partyId === partyBId)!;
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

  const channel: OmniaChannel = {
    channelId:       plan.vcId,
    fundingTxId:     factory.fundingTxId ?? '',
    fundingCoinId:   factory.fundingCoinId ?? '',
    fundingScript:   factory.fundingScript,
    programId:       DefaultEltooPaymentProgram.id,
    programVersion:  DefaultEltooPaymentProgram.version,
    fundingAddress:  factory.fundingAddress,
    tokenId:         factory.tokenId,
    tokenScale:      factory.tokenScale,
    totalValue:      plan.amounts[partyAId] + plan.amounts[partyBId],
    parties:         [partyA, partyB],
    balances:        { [partyAId]: plan.amounts[partyAId], [partyBId]: plan.amounts[partyBId] },
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
    sequence:          plan.newSequence,
    timestamp:         now,
    event:             'virtual_open',
    allocations:       plan.newAllocations,
    virtualChannelIds: plan.newVcIds,
  };

  const updated: ChannelFactory = {
    ...factory,
    allocations:     plan.newAllocations,
    virtualChannels: [...factory.virtualChannels, channel],
    currentSequence: plan.newSequence,
    stateLog:        [...factory.stateLog, logEntry],
  };

  enforceConservation(updated);
  return { factory: updated, channel };
}

export async function openVirtualChannel(
  factory: ChannelFactory,
  parties: [string, string],
  amounts: Record<string, bigint>,
  leaseProviders: Record<string, WotsLeaseBundle>,
  channelId?: string,
): Promise<{ factory: ChannelFactory; channel: OmniaChannel }> {
  for (const p of factory.participants) {
    if (!leaseProviders[p.partyId]) {
      throw new Error(`Missing WotsLeaseBundle for party '${p.partyId}' — openVirtualChannel requires all N`);
    }
  }

  const plan = buildVirtualChannelOpen(factory, parties, amounts, channelId);
  const signatures: Record<string, VirtualChannelOpenSignature> = {};
  for (const p of factory.participants) {
    const sig = await signVirtualChannelOpen(factory, plan, leaseProviders[p.partyId]);
    await leaseProviders[p.partyId].leaseProvider.commitKeyUse(
      sig.reservationId,
      `factory-vc-open-${factory.factoryId}`,
    );
    signatures[p.partyId] = sig;
  }

  return assembleVirtualChannelOpen(factory, plan, signatures, (sig, digest, pkd) => {
    const participant = factory.participants.find(p => p.publicKeyDigest === pkd);
    const bundle = participant ? leaseProviders[participant.partyId] : undefined;
    return (bundle?.verify ?? verifyChannelSignature)(sig, digest, pkd);
  });
}

// ─── closeVirtualChannel ─────────────────────────────────────────────────────

/** Deterministic VC-close plan (no signing). Exported for peer co-signing. */
export interface VirtualChannelClosePlan {
  vcId: string;
  finalAllocations: Record<string, bigint>;
  newSequence: number;
  newAllocations: Record<string, bigint>;
  newVcIds: string[];
  commitment: Uint8Array;
}

export function buildVirtualChannelClose(
  factory: ChannelFactory,
  channel: OmniaChannel,
): VirtualChannelClosePlan {
  const existing = factory.virtualChannels.find(c => c.channelId === channel.channelId);
  if (!existing) throw new Error(`Virtual channel '${channel.channelId}' not found in factory`);

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
  const newVcIds = factory.virtualChannels
    .filter(c => c.channelId !== channel.channelId)
    .map(c => c.channelId);
  const commitment = computeFactoryStateCommitment(
    factory.factoryId,
    newSequence,
    newAllocations,
    newVcIds,
  );

  return {
    vcId: channel.channelId,
    finalAllocations,
    newSequence,
    newAllocations,
    newVcIds,
    commitment,
  };
}

/** Produce this party's VC-close signature without committing the lease. */
export async function signVirtualChannelClose(
  factory: ChannelFactory,
  plan: VirtualChannelClosePlan,
  bundle: WotsLeaseBundle,
): Promise<VirtualChannelOpenSignature> {
  const participant = factory.participants.find(
    p => p.publicKeyDigest === bundle.signer.publicKeyDigest,
  );
  if (!participant) {
    throw new Error('signer.publicKeyDigest does not match any registered factory participant');
  }
  const reservation = await bundle.leaseProvider.reserveKeyUse({
    treeId: `omnia-factory-${factory.factoryId}`,
    purpose: 'factory-vc-close',
    payloadHash: Buffer.from(plan.commitment).toString('hex'),
  });
  let sig: Uint8Array;
  try {
    sig = await bundle.signer.sign(plan.commitment, reservation.indices);
  } catch (err) {
    await bundle.leaseProvider.burnReservation(reservation.reservationId, 'sign-failed').catch(() => {});
    throw err;
  }
  const verifyFn = bundle.verify ?? verifyChannelSignature;
  if (!verifyFn(sig, plan.commitment, participant.publicKeyDigest)) {
    await bundle.leaseProvider.burnReservation(reservation.reservationId, 'verification-failed').catch(() => {});
    throw new Error(`Virtual-channel close signature verification failed for party '${participant.partyId}'`);
  }
  return { partyId: participant.partyId, signature: sig, reservationId: reservation.reservationId };
}

/** Assemble N-of-N VC-close signatures into the updated factory. */
export function assembleVirtualChannelClose(
  factory: ChannelFactory,
  plan: VirtualChannelClosePlan,
  signatures: Record<string, VirtualChannelOpenSignature>,
  verify?: (sig: Uint8Array, digest: Uint8Array, pkd: string) => boolean,
): ChannelFactory {
  for (const p of factory.participants) {
    const s = signatures[p.partyId];
    if (!s) throw new Error(`Missing virtual-channel close signature for party '${p.partyId}' — close requires all N`);
    if (!verifyVirtualChannelOpenSignature(factory, plan.commitment, p.partyId, s.signature, verify)) {
      throw new Error(`Virtual-channel close signature verification failed for party '${p.partyId}'`);
    }
  }

  const logEntry: FactoryLogEntry = {
    sequence: plan.newSequence,
    timestamp: Date.now(),
    event: 'virtual_close',
    allocations: plan.newAllocations,
    virtualChannelIds: plan.newVcIds,
  };

  const updated: ChannelFactory = {
    ...factory,
    allocations: plan.newAllocations,
    virtualChannels: factory.virtualChannels.filter(c => c.channelId !== plan.vcId),
    currentSequence: plan.newSequence,
    stateLog: [...factory.stateLog, logEntry],
  };

  enforceConservation(updated);
  return updated;
}

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
