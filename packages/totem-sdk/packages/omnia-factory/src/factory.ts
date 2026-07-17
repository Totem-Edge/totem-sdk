import { sha3_256 } from '@totemsdk/core';
import { concatBytes, wotsVerifyDigest, fromHex } from '@totemsdk/core';
import {
  buildFundingTx,
  omniaDraftToMinimaBytes,
  computeTxDraftDigest,
} from '@totemsdk/omnia';
import { mineTxPoW, TX_POW_MIN_DIFFICULTY, serializeTxBody } from '@totemsdk/txpow';
import type { ChainStateProvider } from '@totemsdk/chain-provider';
import type {
  ChannelFactory,
  FactoryParticipant,
  WotsLeaseBundle,
  FactoryLogEntry,
} from './types.js';
import { buildAndHashFactoryScript } from './script.js';
import { computeFactoryStateCommitment } from './commitment.js';

// ─── Balance conservation ────────────────────────────────────────────────────

/**
 * Enforce the factory's balance conservation invariant:
 *   sum(allocations) + sum(virtualChannel.totalValue) === totalValue
 *
 * Throws on violation. Called after every committed state transition.
 */
export function enforceConservation(factory: ChannelFactory): void {
  const allocSum = Object.values(factory.allocations).reduce((a, b) => a + b, 0n);
  const vcSum = factory.virtualChannels.reduce((acc, vc) => acc + vc.totalValue, 0n);
  if (allocSum + vcSum !== factory.totalValue) {
    throw new Error(
      `Balance conservation violated: allocations(${allocSum}) + virtualChannels(${vcSum}) ` +
      `!== totalValue(${factory.totalValue})`,
    );
  }
}

// ─── Internal signing helpers ─────────────────────────────────────────────────

/**
 * Execute the full WOTS lease cycle for one party (reserve → sign → verify → commit).
 *
 * Verification uses the optional `bundle.verify` override first; falls back to
 * `wotsVerifyDigest` from `@totemsdk/core`.  If verification fails, the reservation
 * is burned and an error is thrown.
 */
async function leaseSign(
  factoryId: string,
  commitment: Uint8Array,
  purpose: string,
  participant: FactoryParticipant,
  bundle: WotsLeaseBundle,
): Promise<Uint8Array> {
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

  // Verify the signature against the REGISTERED participant public key digest —
  // not self-reported from the signer, ensuring the signer matches the factory record.
  const verifyFn = bundle.verify
    ?? ((s: Uint8Array, c: Uint8Array, pkd: string) => wotsVerifyDigest(s, c, fromHex(pkd)));
  if (!verifyFn(sig, commitment, participant.publicKeyDigest)) {
    await bundle.leaseProvider.burnReservation(reservation.reservationId, 'verification-failed').catch(() => {});
    throw new Error(
      `Signature verification failed for party '${participant.partyId}' — refusing to commit`,
    );
  }

  await bundle.leaseProvider.commitKeyUse(reservation.reservationId, `factory-${factoryId}`);
  return sig;
}

/**
 * Collect N-of-N signatures for a given commitment from ALL factory participants.
 * Throws if any participant's bundle is missing or if any signature fails verification.
 */
async function collectNofN(
  factoryId: string,
  commitment: Uint8Array,
  purpose: string,
  participants: FactoryParticipant[],
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
    await leaseSign(factoryId, commitment, purpose, p, leaseProviders[p.partyId]);
  }
}

// ─── Factory ID ───────────────────────────────────────────────────────────────

function generateFactoryId(participants: FactoryParticipant[], tokenId: string): string {
  const sorted = [...participants].sort((a, b) => a.partyId.localeCompare(b.partyId));
  const nonce = Array.from(
    globalThis.crypto?.getRandomValues?.(new Uint8Array(8)) ?? new Uint8Array(8),
  ).map(b => b.toString(16).padStart(2, '0')).join('');
  const input = JSON.stringify({
    participants: sorted.map(p => ({ partyId: p.partyId, pkd: p.publicKeyDigest })),
    tokenId,
    nonce,
  });
  return Buffer.from(sha3_256(new TextEncoder().encode(input))).toString('hex');
}

// ─── createFactory ────────────────────────────────────────────────────────────

/**
 * Create a factory proposal (proposer step).
 *
 * The calling party (`signer.publicKeyDigest` matches one of `participants`)
 * signs the factory opening commitment via `leaseProvider`, performing the full
 * WOTS reserve → sign → verify → commit cycle.
 *
 * When ALL participants supply `fundingCoinId` and `chainProvider` is given,
 * the N-input → 1-output funding TX is built (via `@totemsdk/omnia`'s
 * `buildFundingTx`), mined (via `@totemsdk/txpow`'s `mineTxPoW`), and broadcast.
 * The TX draft digest is used as the factory opening commitment so that all
 * parties are co-signing the EXACT on-chain TX structure.
 *
 * Without `fundingCoinId`s or `chainProvider`, the factory is in-memory only
 * (useful for testing and off-chain simulation); the commitment falls back to
 * the factory state commitment hash.
 *
 * The returned factory is in `'opening'` status.  Every other participant must
 * call `acceptFactory(factory, leaseProvider, signer)` before the factory
 * transitions to `'active'`.
 *
 * @param participants  - All N factory participants with their contribution amounts.
 * @param tokenId       - Token ID (e.g. `'0x00'` for native Minima).
 * @param leaseProvider - WOTS lease provider for the proposer's key slot.
 * @param signer        - Proposer's channel signer (`signer.publicKeyDigest` must match
 *                        one of the registered participants).
 * @param chainProvider - Optional: build + mine + broadcast the factory funding TX.
 */
export async function createFactory(
  participants: FactoryParticipant[],
  tokenId: string,
  bundle: WotsLeaseBundle,
  chainProvider?: ChainStateProvider,
): Promise<ChannelFactory> {
  if (participants.length < 2) {
    throw new Error(`Factory requires at least 2 participants, got ${participants.length}`);
  }

  // Identify the proposer by public key digest.
  const proposer = participants.find(p => p.publicKeyDigest === bundle.signer.publicKeyDigest);
  if (!proposer) {
    throw new Error(
      'signer.publicKeyDigest does not match any registered factory participant',
    );
  }

  const totalValue = participants.reduce((sum, p) => sum + p.contributionAmount, 0n);
  const allocations: Record<string, bigint> = {};
  for (const p of participants) {
    allocations[p.partyId] = p.contributionAmount;
  }

  const { script, address } = buildAndHashFactoryScript(participants);
  const factoryId = generateFactoryId(participants, tokenId);

  // ── Build + mine + broadcast funding TX (when participants provide UTXOs) ──
  let fundingTxId: string | undefined;
  let fundingCoinId: string | undefined;
  let pendingCommitment: Uint8Array;

  const allHaveCoinId = participants.every(p => p.fundingCoinId);
  if (allHaveCoinId && chainProvider) {
    const fundingDraft = buildFundingTx(
      script,
      address,
      totalValue,
      tokenId,
      0,
      participants.map(p => p.fundingCoinId!),
      participants.map(p => p.contributionAmount),
      participants.map(p => p.settlementAddress ?? p.publicKeyDigest),
    );

    // All parties co-sign the TX digest — the exact on-chain TX structure.
    pendingCommitment = computeTxDraftDigest(fundingDraft);

    const draftBytes  = omniaDraftToMinimaBytes(fundingDraft);
    const txBody      = serializeTxBody(draftBytes, new Uint8Array(0));
    const mined       = await mineTxPoW(txBody, TX_POW_MIN_DIFFICULTY);
    const fullTxPoW   = concatBytes(mined.minedHeaderBytes, new Uint8Array([0x01]), txBody);
    await chainProvider.broadcastTxPoW(Buffer.from(fullTxPoW).toString('hex'));

    fundingTxId   = Buffer.from(mined.txpowId).toString('hex');
    fundingCoinId = `${fundingTxId}-0`;
  } else {
    // In-memory / test path: sign the factory state commitment instead.
    pendingCommitment = computeFactoryStateCommitment(factoryId, 1, allocations, []);
  }

  // Sign with the proposer's lease (full bundle preserved so verify override is available).
  const proposerSig = await leaseSign(
    factoryId,
    pendingCommitment,
    'factory-open',
    proposer,
    bundle,
  );

  const initialEntry: FactoryLogEntry = {
    sequence:          0,
    timestamp:         Date.now(),
    event:             'create',
    allocations:       { ...allocations },
    virtualChannelIds: [],
  };

  const factory: ChannelFactory = {
    factoryId,
    participants,
    totalValue,
    tokenId,
    allocations:        { ...allocations },
    virtualChannels:    [],
    currentSequence:    0,
    status:             'opening',
    stateLog:           [initialEntry],
    fundingScript:      script,
    fundingAddress:     address,
    fundingTxId,
    fundingCoinId,
    pendingCommitment:  Buffer.from(pendingCommitment).toString('hex'),
    pendingSignatures:  { [proposer.partyId]: proposerSig },
  };

  // If proposer is the only participant (edge case), activate immediately.
  if (participants.length === 1) {
    return commitOpening(factory);
  }

  return factory;
}

// ─── acceptFactory ────────────────────────────────────────────────────────────

/**
 * Counterparty co-signs the factory proposal.
 *
 * Each non-proposing participant calls this once. When ALL N parties have
 * signed (proposer via `createFactory` + N-1 counterparties via `acceptFactory`),
 * the factory transitions from `'opening'` to `'active'`.
 *
 * Uses the full WOTS lease cycle: reserve → sign → verify → commit.
 *
 * @param factory       - Factory in `'opening'` status returned by `createFactory`.
 * @param leaseProvider - This counterparty's WOTS lease provider.
 * @param signer        - This counterparty's channel signer (`signer.publicKeyDigest`
 *                        must match a registered participant not yet signed).
 */
export async function acceptFactory(
  factory: ChannelFactory,
  bundle: WotsLeaseBundle,
): Promise<ChannelFactory> {
  if (factory.status !== 'opening') {
    throw new Error(`acceptFactory requires factory status 'opening', got '${factory.status}'`);
  }
  if (!factory.pendingCommitment) {
    throw new Error('Factory has no pending commitment — internal state error');
  }

  const participant = factory.participants.find(
    p => p.publicKeyDigest === bundle.signer.publicKeyDigest,
  );
  if (!participant) {
    throw new Error('signer.publicKeyDigest does not match any registered factory participant');
  }
  if (factory.pendingSignatures[participant.partyId]) {
    throw new Error(`Party '${participant.partyId}' has already co-signed this factory proposal`);
  }

  const commitment = Buffer.from(factory.pendingCommitment, 'hex');
  const sig = await leaseSign(factory.factoryId, commitment, 'factory-open', participant, bundle);

  const newSigs = { ...factory.pendingSignatures, [participant.partyId]: sig };
  const updatedFactory = { ...factory, pendingSignatures: newSigs };

  // When all N parties have signed, commit the opening.
  const allSigned = factory.participants.every(p => newSigs[p.partyId] !== undefined);
  if (allSigned) {
    return commitOpening(updatedFactory);
  }
  return updatedFactory;
}

function commitOpening(factory: ChannelFactory): ChannelFactory {
  const logEntry: FactoryLogEntry = {
    sequence:          1,
    timestamp:         Date.now(),
    event:             'accept',
    allocations:       { ...factory.allocations },
    virtualChannelIds: [],
  };
  const committed: ChannelFactory = {
    ...factory,
    currentSequence:   1,
    status:            'active',
    pendingCommitment: undefined,
    pendingSignatures: {},
    stateLog:          [...factory.stateLog, logEntry],
  };
  enforceConservation(committed);
  return committed;
}

// ─── reallocate ───────────────────────────────────────────────────────────────

/**
 * Move factory allocation between two participants (atomic N-of-N).
 *
 * All N leaseProviders must be supplied; each party signs the new state
 * commitment in turn.  The state commits atomically — no intermediate "pending"
 * object is returned.
 *
 * @param factory        - Active factory.
 * @param fromPartyId    - Party giving up allocation.
 * @param toPartyId      - Party receiving allocation.
 * @param amount         - Amount to transfer (must be positive and within `fromPartyId`'s balance).
 * @param leaseProviders - WOTS lease bundles for ALL N factory participants.
 */
export async function reallocate(
  factory: ChannelFactory,
  fromPartyId: string,
  toPartyId: string,
  amount: bigint,
  leaseProviders: Record<string, WotsLeaseBundle>,
): Promise<ChannelFactory> {
  if (factory.status !== 'active') {
    throw new Error(`reallocate requires factory status 'active', got '${factory.status}'`);
  }
  if (amount <= 0n) {
    throw new Error(`Reallocation amount must be positive, got ${amount}`);
  }

  const fromAlloc = factory.allocations[fromPartyId] ?? 0n;
  if (fromAlloc < amount) {
    throw new Error(`Insufficient allocation for '${fromPartyId}': has ${fromAlloc}, needs ${amount}`);
  }
  if (!factory.participants.find(p => p.partyId === toPartyId)) {
    throw new Error(`'${toPartyId}' is not a registered factory participant`);
  }

  const newAllocations: Record<string, bigint> = {
    ...factory.allocations,
    [fromPartyId]: fromAlloc - amount,
    [toPartyId]:   (factory.allocations[toPartyId] ?? 0n) + amount,
  };
  const newSequence = factory.currentSequence + 1;
  const vcIds       = factory.virtualChannels.map(vc => vc.channelId);

  const commitment = computeFactoryStateCommitment(
    factory.factoryId,
    newSequence,
    newAllocations,
    vcIds,
  );

  await collectNofN(factory.factoryId, commitment, 'factory-reallocate', factory.participants, leaseProviders);

  const logEntry: FactoryLogEntry = {
    sequence:          newSequence,
    timestamp:         Date.now(),
    event:             'reallocate',
    allocations:       newAllocations,
    virtualChannelIds: vcIds,
  };

  const updated: ChannelFactory = {
    ...factory,
    allocations:     newAllocations,
    currentSequence: newSequence,
    stateLog:        [...factory.stateLog, logEntry],
  };

  enforceConservation(updated);
  return updated;
}
