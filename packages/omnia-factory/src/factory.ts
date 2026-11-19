import { sha3_256 } from '@totemsdk/core/wasm';
import { concatBytes } from '@totemsdk/core/wasm';
import { buildScriptProof, computeScriptAddress } from '@totemsdk/core';
import {
  buildFundingTx,
  omniaDraftToMinimaBytes,
  computeOmniaTxDigest,
  minimaOutputCoinIdsForDraft,
  serializeOmniaWitness,
  verifyChannelSignature,
} from '@totemsdk/omnia';
import { mineTxPoW, resolveTxPowTarget, serializeTxBody } from '@totemsdk/txpow';
import type { ChainStateProvider } from '@totemsdk/chain-provider';
import type {
  ChannelFactory,
  FactoryParticipant,
  FactoryFundingMaterial,
  WotsLeaseBundle,
  FactoryLogEntry,
} from './types.js';
import {
  buildAndHashFactoryScript,
  computeFactoryBalanceRoot,
  computeFactoryPartyRoot,
  factoryBalanceRootStateVariable,
  factoryBalanceStateVariables,
  factoryEscapeStateVariable,
  factoryPartyRootStateVariable,
  FACTORY_ESCAPE_DELAY_BLOCKS,
} from './script.js';
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
 * `verifyChannelSignature` from `@totemsdk/omnia` (RFC-037: the wallet's unified
 * WOTS scheme). If verification fails, the reservation is burned and an error is thrown.
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
  const verifyFn = bundle.verify ?? verifyChannelSignature;
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

function generateFactoryId(participants: FactoryParticipant[], tokenId: string, tokenScale: number): string {
  const sorted = [...participants].sort((a, b) => a.partyId.localeCompare(b.partyId));
  const nonce = Array.from(
    globalThis.crypto?.getRandomValues?.(new Uint8Array(8)) ?? new Uint8Array(8),
  ).map(b => b.toString(16).padStart(2, '0')).join('');
  const input = JSON.stringify({
    participants: sorted.map(p => ({ partyId: p.partyId, pkd: p.publicKeyDigest })),
    tokenId,
    tokenScale,
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
 * @param tokenScale    - Token scale exponent (Minima `Token.mTokenScale`). Native Minima
 *                        is 0; coloured coins use `tokenAmount = minimaRawAmount × 10^scale`.
 *                        Defaults to 0.
 */
export async function createFactory(
  participants: FactoryParticipant[],
  tokenId: string,
  bundle: WotsLeaseBundle,
  chainProvider?: ChainStateProvider,
  tokenScale: number = 0,
  funding?: FactoryFundingMaterial[],
): Promise<ChannelFactory> {
  // One plan, one factory ID: build the opening once and reuse it for the
  // proposal, the local record and the funding transaction. Rebuilding here
  // would generate a different ID (the ID includes a random nonce) and the
  // peer would accept a factory this host never stored.
  const plan = await buildFactoryOpening(participants, tokenId, tokenScale, chainProvider, funding);
  return createFactoryFromPlan(plan, bundle, chainProvider);
}

function findProposer(factory: ChannelFactory, bundle: WotsLeaseBundle): FactoryParticipant {
  const proposer = factory.participants.find(p => p.publicKeyDigest === bundle.signer.publicKeyDigest);
  if (!proposer) {
    throw new Error('signer.publicKeyDigest does not match any registered factory participant');
  }
  return proposer;
}

/**
 * Sign the opening commitment for a plan and record the proposer's signature.
 * Nothing is broadcast and no funding signature is requested, so callers can
 * propose the factory to the peer first (CAN-020 ordering).
 */
export async function proposeFactoryOpening(
  plan: FactoryOpeningPlan,
  bundle: WotsLeaseBundle,
): Promise<ChannelFactory> {
  const proposer = findProposer(plan.factory, bundle);
  if (!plan.factory.pendingCommitment) {
    throw new Error('Factory plan has no pending commitment');
  }
  const commitment = Buffer.from(plan.factory.pendingCommitment.replace(/^0x/i, ''), 'hex');
  const sig = await leaseSign(plan.factory.factoryId, commitment, 'factory-open', proposer, bundle);
  return {
    ...plan.factory,
    pendingSignatures: { [proposer.partyId]: sig },
  };
}

/**
 * Finish a plan: collect the funding-witness signatures from the plan's
 * funding materials (or use the supplied ones), broadcast the funding
 * transaction when the plan is on-chain, and commit the opening once every
 * participant has signed.
 */
export async function createFactoryFromPlan(
  plan: FactoryOpeningPlan,
  bundle: WotsLeaseBundle,
  chainProvider?: ChainStateProvider,
): Promise<ChannelFactory> {
  let factory = await proposeFactoryOpening(plan, bundle);

  if (plan.onChain) {
    if (!chainProvider || !plan.fundingTxBytes || !plan.fundingDigest) {
      throw new Error('Factory funding requires a chain provider and a complete funding plan');
    }
    const materials = new Map((plan.fundingMaterials ?? []).map(m => [m.partyId, m]));
    const fundingSignatures: Record<string, Uint8Array> = {};
    for (const participant of factory.participants) {
      const material = materials.get(participant.partyId);
      if (!material) throw new Error(`Missing funding material for factory party '${participant.partyId}'`);
      if (material.signature) {
        fundingSignatures[participant.partyId] = material.signature;
      } else if (material.signer) {
        fundingSignatures[participant.partyId] = Uint8Array.from(await material.signer(plan.fundingDigest));
      } else {
        throw new Error(`Missing signature or signer for factory party '${participant.partyId}'`);
      }
    }
    factory = await finalizeFactoryOpening(
      plan,
      { fundingSignatures, openingSignatures: factory.pendingSignatures },
      chainProvider,
    );
  }

  // If proposer is the only participant (edge case), activate immediately.
  if (factory.participants.length === 1) {
    return commitOpening(factory);
  }

  return factory;
}

/** A factory opening built without any signatures or broadcast. */
export interface FactoryOpeningPlan {
  factory: ChannelFactory;
  fundingTxBytes?: Uint8Array;
  fundingDigest?: Uint8Array;
  fundingCoinId?: string;
  fundingMaterials?: FactoryFundingMaterial[];
  /** State variables seeded into the funding output (OMN-060 roots included). */
  fundingStateVariables?: Array<{ port: number; value: string | bigint; type: string }>;
  onChain: boolean;
}

export interface FinalizeFactoryOpeningOptions {
  /** Funding-witness signatures for every participant (on-chain only). */
  fundingSignatures?: Record<string, Uint8Array>;
  /** Factory opening signatures to record on the proposal. */
  openingSignatures: Record<string, Uint8Array>;
  /**
   * OMN-063: confirmations required before an on-chain factory becomes active.
   * Default 1. A factory whose funding cannot be observed at depth stays
   * `opening` instead of being advertised as operational.
   */
  minConfirmations?: number;
}

/**
 * Build a factory and (when every participant supplies a funding coin) its
 * deterministic funding draft, without signing or broadcasting.
 */
export async function buildFactoryOpening(
  participants: FactoryParticipant[],
  tokenId: string,
  tokenScale: number,
  chainProvider?: ChainStateProvider,
  funding?: FactoryFundingMaterial[],
  /**
   * OMN-058: `enforceCheckpoints` uses the checkpoint-mode covenant, so every
   * allocation change must consume and recreate the factory coin (RFC-079 §4).
   */
  scriptOptions: Parameters<typeof buildAndHashFactoryScript>[1] = {},
): Promise<FactoryOpeningPlan> {
  if (participants.length < 2) {
    throw new Error(`Factory requires at least 2 participants, got ${participants.length}`);
  }
  const totalValue = participants.reduce((sum, p) => sum + p.contributionAmount, 0n);
  const allocations: Record<string, bigint> = {};
  for (const p of participants) allocations[p.partyId] = p.contributionAmount;
  const { script, address } = buildAndHashFactoryScript(participants, scriptOptions);
  const factoryId = generateFactoryId(participants, tokenId, tokenScale);

  let fundingTxBytes: Uint8Array | undefined;
  let fundingDigest: Uint8Array | undefined;
  let fundingCoinId: string | undefined;
  let pendingCommitment: Uint8Array;
  let seededStateVariables: FactoryOpeningPlan['fundingStateVariables'];

  const allHaveCoinId = participants.every(p => p.fundingCoinId);
  if (allHaveCoinId && chainProvider) {
    const materialByParty = new Map((funding ?? []).map(m => [m.partyId, m]));
    const inputAddresses = participants.map(p => {
      const m = materialByParty.get(p.partyId);
      return m?.coinAddress ?? (m?.script ? computeScriptAddress(m.script) : '');
    });
    if (inputAddresses.some(a => !a)) {
      throw new Error(
        'Factory opening on-chain requires funding material (coinAddress or script) for every participant',
      );
    }
    const tip = await chainProvider.getTip();
    const escapeBlock = tip.block + FACTORY_ESCAPE_DELAY_BLOCKS;
    const fundingStateVariables = [
      ...factoryBalanceStateVariables(participants),
      factoryEscapeStateVariable(escapeBlock),
      // OMN-058: the checkpoint sequence starts at zero on the funding coin.
      { port: 104, value: 0n, type: 'number' as const },
      // OMN-060: the covenant asserts SAMESTATE over these roots, so they must
      // exist in the funding output or the assertion is vacuous.
      factoryPartyRootStateVariable(computeFactoryPartyRoot(participants)),
      factoryBalanceRootStateVariable(computeFactoryBalanceRoot(allocations)),
    ];
    seededStateVariables = fundingStateVariables;
    const fundingDraft = buildFundingTx(
      script,
      address,
      totalValue,
      tokenId,
      tokenScale,
      participants.map(p => p.fundingCoinId!),
      participants.map(p => p.contributionAmount),
      inputAddresses,
      fundingStateVariables,
    );
    fundingDigest = computeOmniaTxDigest(fundingDraft);
    fundingTxBytes = omniaDraftToMinimaBytes(fundingDraft);
    fundingCoinId = minimaOutputCoinIdsForDraft(fundingDraft)[0];
    pendingCommitment = fundingDigest;
  } else {
    pendingCommitment = computeFactoryStateCommitment(factoryId, 1, allocations, []);
  }

  const initialEntry: FactoryLogEntry = {
    sequence: 0,
    timestamp: Date.now(),
    event: 'create',
    allocations: { ...allocations },
    virtualChannelIds: [],
  };
  const factory: ChannelFactory = {
    factoryId,
    participants,
    totalValue,
    tokenId,
    tokenScale,
    allocations: { ...allocations },
    virtualChannels: [],
    currentSequence: 0,
    status: 'opening',
    stateLog: [initialEntry],
    fundingScript: script,
    fundingAddress: address,
    fundingTxId: undefined,
    fundingCoinId: undefined,
    pendingCommitment: Buffer.from(pendingCommitment).toString('hex'),
    pendingSignatures: {},
  };
  return {
    factory,
    fundingTxBytes,
    fundingDigest,
    fundingCoinId,
    fundingMaterials: funding,
    ...(seededStateVariables ? { fundingStateVariables: seededStateVariables } : {}),
    onChain: fundingTxBytes !== undefined,
  };
}

/**
 * Broadcast the prepared factory funding (when on-chain) and record opening
 * signatures. When every participant signature is supplied the factory commits.
 */
export async function finalizeFactoryOpening(
  plan: FactoryOpeningPlan,
  opts: FinalizeFactoryOpeningOptions,
  chainProvider?: ChainStateProvider,
): Promise<ChannelFactory> {
  let factory = plan.factory;
  if (plan.onChain) {
    if (!chainProvider || !plan.fundingTxBytes) throw new Error('Factory funding requires a chain provider');
    const materials = new Map((plan.fundingMaterials ?? []).map(m => [m.partyId, m]));
    const signatures: Uint8Array[] = [];
    const coinProofs: Uint8Array[] = [];
    const scriptProofs: Uint8Array[] = [];
    for (const participant of factory.participants) {
      const signature = opts.fundingSignatures?.[participant.partyId];
      if (!signature) throw new Error(`Missing funding signature for factory party '${participant.partyId}'`);
      const material = materials.get(participant.partyId);
      if (!material) throw new Error(`Missing funding material for factory party '${participant.partyId}'`);
      coinProofs.push(material.coinProof);
      const scriptProof = material.scriptProof ?? (material.script ? buildScriptProof(material.script) : undefined);
      if (!scriptProof) throw new Error(`Missing script or scriptProof for factory party '${participant.partyId}'`);
      scriptProofs.push(scriptProof);
      signatures.push(signature);
    }
    const witnessBytes = serializeOmniaWitness({ signatures, coinProofs, scriptProofs });
    let fundingTxId: string;
    if (chainProvider.submitTransaction) {
      const submitted = await chainProvider.submitTransaction(plan.fundingTxBytes, witnessBytes);
      if (submitted.success === false || !submitted.txpowid) {
        throw new Error(`Factory funding submission failed: ${submitted.message ?? 'no txpowid'}`);
      }
      fundingTxId = submitted.txpowid;
    } else {
      const txnDifficulty = await resolveTxPowTarget(chainProvider);
      const txBody = serializeTxBody(plan.fundingTxBytes, witnessBytes, { txnDifficulty });
      const mined = await mineTxPoW(txBody, txnDifficulty);
      const fullTxPoW = concatBytes(concatBytes(mined.minedHeaderBytes, new Uint8Array([0x01])), txBody);
      const broadcast = await chainProvider.broadcastTxPoW(Buffer.from(fullTxPoW).toString('hex'));
      if (broadcast.success === false) {
        throw new Error(`Factory funding broadcast failed: ${broadcast.message ?? 'unknown error'}`);
      }
      fundingTxId = broadcast.txpowid ?? Buffer.from(mined.txpowId).toString('hex');
    }
    factory = {
      ...factory,
      fundingTxId,
      fundingCoinId: plan.fundingCoinId,
    };

    // OMN-063: submission is not finality. Only a coin observed at the required
    // depth may become an active factory.
    const required = opts.minConfirmations ?? 1;
    if (required > 0) {
      let confirmed = false;
      if (plan.fundingCoinId && typeof chainProvider.getTip === 'function') {
        const coin = await chainProvider.getCoin(plan.fundingCoinId);
        const tip = await chainProvider.getTip();
        const created = Number((coin as { created?: unknown } | null)?.created ?? 0);
        confirmed = Boolean(coin && !coin.spent && created > 0 && tip.block - created + 1 >= required);
      }
      if (!confirmed) {
        return { ...factory, pendingSignatures: { ...opts.openingSignatures } };
      }
    }
  }

  factory = { ...factory, pendingSignatures: { ...opts.openingSignatures } };
  const allSigned = factory.participants.every(p => factory.pendingSignatures[p.partyId] !== undefined);
  return allSigned ? commitOpening(factory) : factory;
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
  opts?: { deferCommit?: boolean },
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

  const commitment = Buffer.from(factory.pendingCommitment.replace(/^0x/i, ''), 'hex');
  const sig = await leaseSign(factory.factoryId, commitment, 'factory-open', participant, bundle);

  const newSigs = { ...factory.pendingSignatures, [participant.partyId]: sig };
  const updatedFactory = { ...factory, pendingSignatures: newSigs };

  // When all N parties have signed, commit the opening unless the host is
  // waiting for funding evidence (on-chain) or the proposer's FINALIZED.
  const allSigned = factory.participants.every(p => newSigs[p.partyId] !== undefined);
  if (allSigned && !opts?.deferCommit) {
    return commitOpening(updatedFactory);
  }
  return updatedFactory;
}

// ─── Remote opening aggregation (RFC-035 B2) ──────────────────────────────────

/** A co-signer's opening signature, held until the opening is confirmed. */
export interface FactoryOpeningSignature {
  factoryId: string;
  partyId: string;
  signature: Uint8Array;
  reservationId: string;
}

/**
 * Produce this party's opening signature WITHOUT committing the lease
 * (RFC-035 B2). The caller commits on `FACTORY_FINALIZED` or burns on expiry —
 * mirroring the splice accept round so a peer can gather N-of-N signatures
 * without stranding or prematurely committing one-time keys.
 */
export async function signFactoryOpening(
  factory: ChannelFactory,
  bundle: WotsLeaseBundle,
): Promise<FactoryOpeningSignature> {
  if (factory.status !== 'opening' || !factory.pendingCommitment) {
    throw new Error(`signFactoryOpening requires an 'opening' factory, got '${factory.status}'`);
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

  const commitment = Buffer.from(factory.pendingCommitment.replace(/^0x/i, ''), 'hex');
  const reservation = await bundle.leaseProvider.reserveKeyUse({
    treeId: `omnia-factory-${factory.factoryId}`,
    purpose: 'factory-open',
    payloadHash: Buffer.from(commitment).toString('hex'),
  });

  let sig: Uint8Array;
  try {
    sig = await bundle.signer.sign(commitment, reservation.indices);
  } catch (err) {
    await bundle.leaseProvider.burnReservation(reservation.reservationId, 'sign-failed').catch(() => {});
    throw err;
  }

  const verifyFn =
    bundle.verify ?? ((s: Uint8Array, c: Uint8Array, pkd: string) => verifyChannelSignature(s, c, pkd));
  if (!verifyFn(sig, commitment, participant.publicKeyDigest)) {
    await bundle.leaseProvider.burnReservation(reservation.reservationId, 'verification-failed').catch(() => {});
    throw new Error(`Signature verification failed for party '${participant.partyId}' — refusing to commit`);
  }

  return {
    factoryId: factory.factoryId,
    partyId: participant.partyId,
    signature: sig,
    reservationId: reservation.reservationId,
  };
}

/** Verify a remote opening signature against a factory participant. */
export function verifyFactorySignature(
  factory: ChannelFactory,
  partyId: string,
  signature: Uint8Array,
  verify?: (sig: Uint8Array, commitment: Uint8Array, pkd: string) => boolean,
): boolean {
  if (!factory.pendingCommitment) return false;
  const participant = factory.participants.find(p => p.partyId === partyId);
  if (!participant) return false;
  const commitment = Buffer.from(factory.pendingCommitment.replace(/^0x/i, ''), 'hex');
  const verifyFn =
    verify ?? ((s: Uint8Array, c: Uint8Array, pkd: string) => verifyChannelSignature(s, c, pkd));
  try {
    return verifyFn(signature, commitment, participant.publicKeyDigest);
  } catch {
    return false;
  }
}

/**
 * Merge a co-signer's opening signature (RFC-035 B2). When all N participants
 * have signed, the opening commits (`'opening'` → `'active'`).
 */
export function applyFactorySignature(
  factory: ChannelFactory,
  partyId: string,
  signature: Uint8Array,
): ChannelFactory {
  if (factory.status !== 'opening') {
    throw new Error(`applyFactorySignature requires factory status 'opening', got '${factory.status}'`);
  }
  if (!factory.participants.find(p => p.partyId === partyId)) {
    throw new Error(`'${partyId}' is not a registered factory participant`);
  }
  if (factory.pendingSignatures[partyId]) {
    throw new Error(`Party '${partyId}' has already co-signed this factory proposal`);
  }
  const newSigs = { ...factory.pendingSignatures, [partyId]: signature };
  const updated: ChannelFactory = { ...factory, pendingSignatures: newSigs };
  const allSigned = factory.participants.every(p => newSigs[p.partyId] !== undefined);
  return allSigned ? commitOpening(updated) : updated;
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

// ─── Peer-supplied state validation ──────────────────────────────────────────

function jsonSafeForCompare(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(jsonSafeForCompare);
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, jsonSafeForCompare(v)] as const);
    return Object.fromEntries(entries);
  }
  return value;
}

function factoryTermsFingerprint(f: ChannelFactory): string {
  return JSON.stringify(jsonSafeForCompare({
    factoryId: f.factoryId,
    participants: f.participants,
    totalValue: f.totalValue,
    tokenId: f.tokenId,
    tokenScale: f.tokenScale,
    allocations: f.allocations,
    virtualChannels: f.virtualChannels,
    currentSequence: f.currentSequence,
    stateLog: f.stateLog,
    fundingScript: f.fundingScript,
    fundingAddress: f.fundingAddress,
    pendingCommitment: f.pendingCommitment,
  }));
}

/**
 * Validate a peer-supplied `FACTORY_FINALIZED` transition against the locally
 * accepted factory. The peer may only fill in the funding references and add
 * valid opening signatures; every term, commitment and existing signature must
 * be identical. Returns the validated factory to store.
 */
export function assertFactoryFinalized(
  known: ChannelFactory,
  incoming: ChannelFactory,
  senderPublicKeyDigest?: string,
): ChannelFactory {
  if (!incoming || incoming.factoryId !== known.factoryId) {
    throw new Error('FACTORY_FINALIZED for a different factory');
  }
  if (senderPublicKeyDigest && !known.participants.some(p => p.publicKeyDigest === senderPublicKeyDigest)) {
    throw new Error('FACTORY_FINALIZED sender is not a factory participant');
  }

  const terms = (f: ChannelFactory): string => JSON.stringify(jsonSafeForCompare({
    participants: f.participants,
    totalValue: f.totalValue,
    tokenId: f.tokenId,
    tokenScale: f.tokenScale,
    allocations: f.allocations,
    virtualChannels: f.virtualChannels,
    fundingScript: f.fundingScript,
    fundingAddress: f.fundingAddress,
  }));
  if (terms(known) !== terms(incoming)) {
    throw new Error('FACTORY_FINALIZED changes factory terms');
  }
  if (known.fundingTxId && incoming.fundingTxId !== known.fundingTxId) {
    throw new Error('FACTORY_FINALIZED changes the funding transaction');
  }
  if (known.fundingCoinId && incoming.fundingCoinId !== known.fundingCoinId) {
    throw new Error('FACTORY_FINALIZED changes the funding coin');
  }
  if (known.status === 'closed' && incoming.status !== 'closed') {
    throw new Error('FACTORY_FINALIZED cannot reopen a closed factory');
  }

  // The expected transition for a proposal this host accepted with every
  // participant signature present is the deterministic commit: sequence 1, an
  // 'accept' log entry, cleared pending commitment and signatures.
  if (known.status === 'opening' && incoming.status === 'active') {
    if (known.currentSequence !== 0 || incoming.currentSequence !== 1) {
      throw new Error('FACTORY_FINALIZED has an invalid sequence for an opening');
    }
    if (!known.pendingCommitment) {
      throw new Error('FACTORY_FINALIZED for a proposal without a pending commitment');
    }
    const commitment = Buffer.from(known.pendingCommitment.replace(/^0x/i, ''), 'hex');
    const signatures = known.pendingSignatures ?? {};
    for (const participant of known.participants) {
      const sig = signatures[participant.partyId];
      if (!sig) throw new Error(`FACTORY_FINALIZED activates a factory missing the signature for '${participant.partyId}'`);
      if (!verifyChannelSignature(sig, commitment, participant.publicKeyDigest)) {
        throw new Error(`FACTORY_FINALIZED activates a factory with an invalid signature for '${participant.partyId}'`);
      }
    }
    if (incoming.pendingCommitment) {
      throw new Error('FACTORY_FINALIZED must clear the pending commitment when it activates');
    }
    if (incoming.pendingSignatures && Object.keys(incoming.pendingSignatures).length > 0) {
      throw new Error('FACTORY_FINALIZED must clear pending signatures when it activates');
    }
    const log = incoming.stateLog ?? [];
    if (log.length !== (known.stateLog?.length ?? 0) + 1) {
      throw new Error('FACTORY_FINALIZED has an unexpected state log');
    }
    const last = log[log.length - 1];
    if (!last || last.event !== 'accept' || last.sequence !== 1) {
      throw new Error('FACTORY_FINALIZED is missing the accept log entry');
    }
    if (JSON.stringify(jsonSafeForCompare(last.allocations)) !== JSON.stringify(jsonSafeForCompare(known.allocations))) {
      throw new Error('FACTORY_FINALIZED changes allocations in the accept entry');
    }
    return { ...incoming, pendingSignatures: {} };
  }

  if (known.status === 'active' && incoming.status === 'active') {
    // Funding references may be filled in after activation; terms are already checked.
    return { ...incoming };
  }
  if (known.status === 'opening' && incoming.status === 'opening') {
    // Funding references only; signatures may not be removed or altered.
    const knownSigs = known.pendingSignatures ?? {};
    const incomingSigs = incoming.pendingSignatures ?? {};
    for (const [partyId, sig] of Object.entries(knownSigs)) {
      const next = incomingSigs[partyId];
      if (!next || Buffer.from(next).toString('hex') !== Buffer.from(sig).toString('hex')) {
        throw new Error(`FACTORY_FINALIZED removes or alters the signature for '${partyId}'`);
      }
    }
    return { ...incoming, pendingSignatures: { ...incomingSigs } };
  }
  throw new Error('FACTORY_FINALIZED has an unsupported status transition');
}
