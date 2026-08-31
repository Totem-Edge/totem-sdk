/**
 * admission/mine.ts — Machine Work Admission mining.
 *
 * Mines a real Minima block candidate whose customHash commits to the machine
 * action. The mining loop reuses the existing TxPoW mining loop
 * (`mineHeaderTail` from ../mine.js) — the same SHA3-256 nonce search that
 * Minima uses for transaction/block mining.
 *
 * Two thresholds:
 *   - admission target (receiver-chosen, easier): hash < admissionTarget
 *   - L1 block target (current Minima block difficulty): hash < blockTarget
 *
 * The loop stops as soon as the admission target is satisfied, unless the same
 * search already discovered a block-target winner. Ordinary admission proofs
 * stay off-chain; only genuine L1 winners are broadcast via the injected
 * template provider.
 */

import { sha3_256 } from '@totemsdk/core';
import { mineHeaderTail, type MineOptions } from '../mine.js';
import { computeActionCommitment } from './commitment.js';
import { buildBlockHeaderTail, isBlockWinner } from './template.js';
import {
  MACHINE_WORK_ADMISSION_VERSION,
  type MachineWorkAction,
  type MachineWorkAdmissionProof,
  type MinimaWorkTemplate,
  type MinimaWorkTemplateProvider,
  type WorkChallenge,
} from './types.js';

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Empty serialized TxBody hash (fresh block candidate with empty body). */
const EMPTY_BODY_HASH = toHex(sha3_256(new Uint8Array(0)));

export interface MineWorkAdmissionOptions {
  /** AbortSignal — rejects the Promise when aborted. */
  signal?: AbortSignal;
  /** Hard cap on total iterations (default: unlimited). */
  maxIterations?: number;
  /** Hash iterations per async yield (default: 10_000). */
  chunkSize?: number;
  /** Override the template timeMilli for deterministic testing. */
  timeMilli?: bigint;
  /** Force the pure-JS mining path (for testing). */
  forceJs?: boolean;
  /** Skip the Node.js worker_threads Worker (for testing). */
  _skipWorker?: boolean;
  /**
   * Staleness window (ms) within which a template is still acceptable for
   * admission even if the chain tip has moved. Default: 5 minutes.
   */
  admissionWindowMs?: number;
}

/**
 * Mine a Machine Work Admission proof.
 *
 * @param action           The application action.
 * @param challenge        The receiver-issued challenge.
 * @param admissionTarget  32-byte admission target (hex). MUST be easier than
 *                         or equal to the block target for the search to be
 *                         meaningful (admission is a subset of block search).
 * @param templateProvider Injected provider for the current Minima template.
 * @param options          Mining options.
 */
export async function mineWorkAdmission(
  action: MachineWorkAction,
  challenge: WorkChallenge,
  admissionTarget: string,
  templateProvider: MinimaWorkTemplateProvider,
  options?: MineWorkAdmissionOptions
): Promise<MachineWorkAdmissionProof> {
  const template = await templateProvider.getCurrentTemplate();
  if (templateProvider.validateTemplate) {
    const ok = await templateProvider.validateTemplate(template);
    if (!ok) throw new Error('Minima work template failed validation');
  }

  const actionCommitment = computeActionCommitment(action, challenge);
  const admissionTargetBytes = hexToBytes(admissionTarget);
  const blockTargetBytes = hexToBytes(template.blockDifficulty);

  // The admission target must be easier than or equal to the block target,
  // otherwise the search would be chasing a block that can never admit.
  if (!isLessThanOrEqual(blockTargetBytes, admissionTargetBytes)) {
    throw new Error(
      'admissionTarget must be easier than or equal to the current block target'
    );
  }

  const timeMilli = options?.timeMilli ?? template.timeMilli;
  const headerTail = buildBlockHeaderTail(template, actionCommitment, EMPTY_BODY_HASH);

  // Mine against the admission target. The same nonce search also checks the
  // block target: if the winning hash beats the block target, it is a winner.
  const result = await mineHeaderTail(headerTail, admissionTargetBytes, {
    signal: options?.signal,
    maxIterations: options?.maxIterations,
    chunkSize: options?.chunkSize,
    timeMilli,
    forceJs: options?.forceJs,
    _skipWorker: options?._skipWorker,
  });

  const qualifiesAsMinimaBlock = isBlockWinner(result.txpowId, template.blockDifficulty);

  const proof: MachineWorkAdmissionProof = {
    version: MACHINE_WORK_ADMISSION_VERSION,
    actionCommitment,
    challengeId: challenge.challengeId,
    admissionTarget,
    txpow: toHex(result.minedHeaderBytes),
    txpowId: toHex(result.txpowId),
    nonce: result.nonce.toString(),
    minedAt: Date.now(),
    qualifiesForAdmission: true,
    qualifiesAsMinimaBlock,
    template,
  };

  // Broadcast genuine L1 winners exactly once, and only if the template is
  // still current. Ordinary admission proofs are never broadcast.
  if (qualifiesAsMinimaBlock && templateProvider.broadcastBlockCandidate) {
    const latest = await templateProvider.getCurrentTemplate();
    if (latest.templateId === template.templateId) {
      await templateProvider.broadcastBlockCandidate(proof);
    }
  }

  return proof;
}

function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < h.length; i += 2) {
    out[i / 2] = parseInt(h.slice(i, i + 2), 16);
  }
  return out;
}

/** Big-endian 256-bit comparison: true if a <= b. */
function isLessThanOrEqual(a: Uint8Array, b: Uint8Array): boolean {
  for (let i = 0; i < 32; i++) {
    if (a[i] < b[i]) return true;
    if (a[i] > b[i]) return false;
  }
  return true;
}
