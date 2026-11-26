import { OmniaVtxo, ExitDraft, VtxoOperatorReceipt, VtxoExitState } from './types.js';
import { VtxoStatusError, VtxoExitError, VtxoProofError } from './errors.js';

import { computeReceiptId, computeVtxoLeaf } from './commitment.js';

/**
 * Transitions an active VTXO to 'exiting' status.
 * @param now - Timestamp in ms. Defaults to Date.now() if omitted — pass explicitly for determinism.
 */
export function markExiting(vtxo: OmniaVtxo, now?: number): OmniaVtxo {
  const ts = now !== undefined ? now : Date.now();
  if (vtxo.status !== 'active') {
    throw new VtxoStatusError(
      `Cannot initiate exit for VTXO ${vtxo.vtxoId}: status is '${vtxo.status}'`,
      vtxo.status,
    );
  }
  return {
    ...vtxo,
    status: 'exiting',
    updatedAt: ts,
    history: [
      ...vtxo.history,
      { op: 'exit_initiated', at: ts },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// OMN-089 — exit progress is broadcast → confirmed → settled
// ─────────────────────────────────────────────────────────────────────────────

export interface ExitConfirmationInput {
  txpowId: string;
  block: number;
  vtxo: OmniaVtxo;
}

/**
 * What a chain verifier observed for an exit transaction. A verifier that
 * cannot see the transaction must return `confirmed: false`.
 */
export interface ExitConfirmationEvidence {
  confirmed: boolean;
  block?: number;
  /** Owner the exit transaction paid, when the verifier can read it. */
  owner?: string;
  /** Amount the exit transaction paid, in the same units as `vtxo.amount`. */
  amount?: string;
}

/**
 * Record that an exit transaction exists. This is bookkeeping only: it does not
 * claim the transaction is confirmed or that it pays the right party.
 */
export function markExitBroadcast(
  vtxo: OmniaVtxo,
  options: { txpowId: string; now?: number },
): OmniaVtxo {
  const ts = options.now !== undefined ? options.now : Date.now();
  if (vtxo.status !== 'exiting' && vtxo.status !== 'active') {
    throw new VtxoStatusError(
      `Cannot broadcast exit for VTXO ${vtxo.vtxoId}: status is '${vtxo.status}'`,
      vtxo.status,
    );
  }
  if (!options.txpowId || !options.txpowId.trim()) {
    throw new VtxoExitError(
      `Cannot record exit broadcast for VTXO ${vtxo.vtxoId}: the exit transaction id is required`,
    );
  }
  return {
    ...vtxo,
    status: 'exiting',
    exitTxpowId: options.txpowId,
    exitState: 'broadcast',
    updatedAt: ts,
    history: [
      ...vtxo.history,
      { op: 'exit_initiated', at: ts, meta: { stage: 'broadcast', txpowId: options.txpowId } },
    ],
  };
}

/**
 * Record chain confirmation of the exit, from an authoritative verifier.
 *
 * The verifier is required: without one there is nothing to distinguish a real
 * confirmation from a caller asserting one.
 */
export async function markExitConfirmed(
  vtxo: OmniaVtxo,
  options: {
    txpowId: string;
    verify: (
      input: ExitConfirmationInput,
    ) => Promise<ExitConfirmationEvidence> | ExitConfirmationEvidence;
    now?: number;
  },
): Promise<OmniaVtxo> {
  const ts = options.now !== undefined ? options.now : Date.now();
  if (vtxo.status !== 'exiting') {
    throw new VtxoStatusError(
      `Cannot confirm exit for VTXO ${vtxo.vtxoId}: status is '${vtxo.status}'`,
      vtxo.status,
    );
  }
  if (vtxo.exitTxpowId && vtxo.exitTxpowId !== options.txpowId) {
    throw new VtxoExitError(
      `Cannot confirm exit for VTXO ${vtxo.vtxoId}: ${options.txpowId} is not the broadcast transaction ${vtxo.exitTxpowId}`,
    );
  }

  const evidence = await options.verify({ txpowId: options.txpowId, block: 0, vtxo });
  if (!evidence || evidence.confirmed !== true) {
    throw new VtxoExitError(
      `Cannot confirm exit for VTXO ${vtxo.vtxoId}: the chain verifier did not confirm ${options.txpowId}`,
    );
  }
  if (evidence.owner !== undefined && evidence.owner !== vtxo.owner) {
    throw new VtxoExitError(
      `Cannot confirm exit for VTXO ${vtxo.vtxoId}: the exit pays ${evidence.owner}, not ${vtxo.owner}`,
    );
  }
  if (evidence.amount !== undefined && evidence.amount !== vtxo.amount.toString()) {
    throw new VtxoExitError(
      `Cannot confirm exit for VTXO ${vtxo.vtxoId}: the exit pays ${evidence.amount}, not ${vtxo.amount.toString()}`,
    );
  }

  return {
    ...vtxo,
    status: 'exiting',
    exitTxpowId: options.txpowId,
    exitState: 'confirmed',
    ...(evidence.block !== undefined ? { exitBlock: evidence.block } : {}),
    updatedAt: ts,
    history: [
      ...vtxo.history,
      {
        op: 'exit_initiated',
        at: ts,
        meta: { stage: 'confirmed', txpowId: options.txpowId, ...(evidence.block !== undefined ? { block: evidence.block } : {}) },
      },
    ],
  };
}

/**
 * Final transition: the exit is settled and the VTXO is no longer a claim on
 * the pool. Requires a prior confirmation, or explicit evidence for the callers
 * that verified settlement in another layer.
 */
export function markExitSettled(
  vtxo: OmniaVtxo,
  options: { txpowId: string; evidence?: ExitConfirmationEvidence; now?: number },
): OmniaVtxo {
  const ts = options.now !== undefined ? options.now : Date.now();
  if (vtxo.status !== 'exiting') {
    throw new VtxoStatusError(
      `Cannot settle exit for VTXO ${vtxo.vtxoId}: status is '${vtxo.status}'`,
      vtxo.status,
    );
  }
  if (vtxo.exitTxpowId && vtxo.exitTxpowId !== options.txpowId) {
    throw new VtxoExitError(
      `Cannot settle exit for VTXO ${vtxo.vtxoId}: ${options.txpowId} is not the broadcast transaction ${vtxo.exitTxpowId}`,
    );
  }

  const confirmed = vtxo.exitState === 'confirmed' || options.evidence?.confirmed === true;
  if (!confirmed) {
    throw new VtxoExitError(
      `Cannot settle exit for VTXO ${vtxo.vtxoId}: the exit is '${vtxo.exitState ?? 'not recorded'}' and no confirmation evidence was supplied`,
    );
  }
  if (options.evidence?.owner !== undefined && options.evidence.owner !== vtxo.owner) {
    throw new VtxoExitError(
      `Cannot settle exit for VTXO ${vtxo.vtxoId}: the exit pays ${options.evidence.owner}, not ${vtxo.owner}`,
    );
  }
  if (options.evidence?.amount !== undefined && options.evidence.amount !== vtxo.amount.toString()) {
    throw new VtxoExitError(
      `Cannot settle exit for VTXO ${vtxo.vtxoId}: the exit pays ${options.evidence.amount}, not ${vtxo.amount.toString()}`,
    );
  }

  return {
    ...vtxo,
    status: 'exited',
    exitTxpowId: options.txpowId,
    exitState: 'settled',
    updatedAt: ts,
    history: [
      ...vtxo.history,
      { op: 'exit_complete', at: ts, meta: { txpowId: options.txpowId } },
    ],
  };
}

/**
 * One-step exit completion.
 *
 * OMN-089: this is a **trusted reducer**. It now requires either chain evidence
 * (`evidence.confirmed`) or an explicit `trusted: true` declaration — a bare
 * transaction id is no longer enough to mark a VTXO as exited. Callers that
 * verified settlement elsewhere (for example the pool payout path, which checks
 * finality before calling) pass `trusted: true` and own that assertion.
 */
export function markExited(
  vtxo: OmniaVtxo,
  options: {
    txpowId: string;
    evidence?: ExitConfirmationEvidence;
    trusted?: boolean;
    now?: number;
  },
): OmniaVtxo {
  if (!options.txpowId || !options.txpowId.trim()) {
    throw new VtxoExitError(
      `Cannot mark VTXO ${vtxo.vtxoId} as exited: the exit transaction id is required`,
    );
  }
  if (vtxo.status !== 'exiting') {
    throw new VtxoStatusError(
      `Cannot mark VTXO ${vtxo.vtxoId} as exited: status is '${vtxo.status}'`,
      vtxo.status,
    );
  }
  if (options.evidence === undefined && options.trusted !== true) {
    throw new VtxoExitError(
      `Cannot mark VTXO ${vtxo.vtxoId} as exited: supply chain evidence or an explicit trusted:true `
      + '(a transaction id alone does not prove the exit). Prefer markExitBroadcast → markExitConfirmed → markExitSettled.',
    );
  }
  const settled: OmniaVtxo = {
    ...vtxo,
    status: 'exiting',
    exitTxpowId: options.txpowId,
    ...(options.evidence?.block !== undefined ? { exitBlock: options.evidence.block } : {}),
  };
  return markExitSettled(settled, {
    txpowId: options.txpowId,
    ...(options.evidence ? { evidence: options.evidence } : { evidence: { confirmed: true } }),
    ...(options.now !== undefined ? { now: options.now } : {}),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// OMN-088 — an exit draft reserves the VTXO atomically
// ─────────────────────────────────────────────────────────────────────────────

export interface ExitDraftReservation {
  draft: ExitDraft;
  receipt: VtxoOperatorReceipt;
  /** VTXO with the exit reservation applied. Persist this. */
  vtxo: OmniaVtxo;
}

export interface VtxoExitDraftStore {
  /**
   * Atomically reserve an exit for a VTXO. A repeat for the same VTXO returns
   * the original draft instead of a second one.
   */
  reserve(input: ExitDraftReservation & { vtxoId: string }): Promise<
    ExitDraftReservation & { created: boolean }
  >;
  /** The reservation already recorded for a VTXO, if any. */
  get(vtxoId: string): Promise<ExitDraftReservation | undefined>;
}

/** Default in-process store. Inject a durable one to survive a restart. */
export function createMemoryExitDraftStore(): VtxoExitDraftStore {
  const reservations = new Map<string, ExitDraftReservation>();
  return {
    async reserve(input) {
      const existing = reservations.get(input.vtxoId);
      if (existing) return { ...existing, created: false };
      const value: ExitDraftReservation = {
        draft: input.draft,
        receipt: input.receipt,
        vtxo: input.vtxo,
      };
      reservations.set(input.vtxoId, value);
      return { ...value, created: true };
    },
    async get(vtxoId) {
      return reservations.get(vtxoId);
    },
  };
}

/**
 * Validates the VTXO's proof leaf integrity before creating an exit draft.
 * Throws VtxoProofError if the proof leaf is present but does not match the VTXO fields.
 */
function assertProofLeafValid(vtxo: OmniaVtxo): void {
  if (!vtxo.proof.leaf) return;
  const expectedLeaf = computeVtxoLeaf(vtxo);
  if (vtxo.proof.leaf !== expectedLeaf) {
    throw new VtxoProofError(
      `Exit draft rejected: VTXO ${vtxo.vtxoId} proof leaf mismatch. ` +
      `Expected ${expectedLeaf}, got ${vtxo.proof.leaf}`
    );
  }
}

/** The pure draft builder. Does **not** reserve anything — use `createExitDraft`. */
export function buildExitDraft(
  vtxo: OmniaVtxo,
  now?: number,
): { draft: ExitDraft; receipt: VtxoOperatorReceipt } {
  const ts = now !== undefined ? now : Date.now();

  if (vtxo.status !== 'active' && vtxo.status !== 'exiting') {
    throw new VtxoExitError(
      `Cannot create exit draft for VTXO ${vtxo.vtxoId}: status is '${vtxo.status}'`
    );
  }
  if (vtxo.exitConsumedAt !== undefined) {
    throw new VtxoExitError(
      `Cannot create exit draft for VTXO ${vtxo.vtxoId}: exit already consumed by ${vtxo.exitReceiptId}`
    );
  }

  assertProofLeafValid(vtxo);

  const draft: ExitDraft = {
    vtxoId: vtxo.vtxoId,
    poolId: vtxo.poolId,
    owner: vtxo.owner,
    amount: vtxo.amount,
    tokenId: vtxo.tokenId,
    draftType: 'vtxo-exit',
    timelockSeconds: 86400,
    createdAt: ts,
    verifiedShare: vtxo.amount,
  };

  const receiptId = computeReceiptId(vtxo.poolId, 'exit_initiated', [vtxo.vtxoId], [], ts);
  const receipt: VtxoOperatorReceipt = {
    receiptId,
    poolId: vtxo.poolId,
    op: 'exit_initiated',
    inputIds: [vtxo.vtxoId],
    outputIds: [],
    epoch: vtxo.epoch,
    at: ts,
    signature: '',
    draftType: 'vtxo-exit',
  };

  return { draft, receipt };
}

/**
 * Create **and reserve** an exit draft (OMN-088).
 *
 * The VTXO's receipt is consumed by the reservation, and a repeat request
 * returns the original draft rather than producing a competing one. The store
 * is required: a draft that nobody reserved was the double-exit hole.
 */
export async function createExitDraft(
  vtxo: OmniaVtxo,
  store: VtxoExitDraftStore,
  now?: number,
): Promise<ExitDraftReservation & { created: boolean }> {
  const ts = now !== undefined ? now : Date.now();

  if (vtxo.exitConsumedAt !== undefined) {
    const existing = await store.get(vtxo.vtxoId);
    if (existing) return { ...existing, created: false };
    throw new VtxoExitError(
      `VTXO ${vtxo.vtxoId} is marked exit-consumed (${vtxo.exitReceiptId}) but the exit store has no record`,
    );
  }

  const { draft, receipt } = buildExitDraft(vtxo, ts);
  const reserved = consumeExitReceipt(vtxo, receipt.receiptId, ts);
  return store.reserve({ vtxoId: vtxo.vtxoId, draft, receipt, vtxo: reserved });
}

/**
 * Consume a VTXO's exit receipt — the single-spend marker that prevents a
 * second exit draft for the same VTXO. Returns the updated VTXO.
 */
export function consumeExitReceipt(vtxo: OmniaVtxo, receiptId: string, now?: number): OmniaVtxo {
  if (vtxo.exitConsumedAt !== undefined) {
    throw new VtxoExitError(
      `VTXO ${vtxo.vtxoId} exit already consumed by ${vtxo.exitReceiptId}`,
    );
  }
  return {
    ...vtxo,
    exitConsumedAt: now ?? Date.now(),
    exitReceiptId: receiptId,
    updatedAt: now ?? Date.now(),
  };
}

/** Narrow a VTXO's exit progress. `undefined` means no exit has been recorded. */
export function exitProgress(vtxo: OmniaVtxo): VtxoExitState | undefined {
  return vtxo.exitState;
}
