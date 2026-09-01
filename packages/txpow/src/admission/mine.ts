/**
 * admission/mine.ts — Machine Work Admission mining.
 *
 * Mines a real Minima block candidate whose customHash commits to the machine
 * action. The mining loop reuses the existing TxPoW mining loop
 * (`mineHeaderTail` from ../mine.js) — the same SHA3-256 nonce search that
 * Minima uses for transaction/block mining.
 *
 * The admission target is ALWAYS `challenge.target` — the challenge is the
 * single source of truth. There is no separate admission target argument.
 *
 * Two thresholds:
 *   - admission target (receiver-chosen, easier): hash < challenge.target
 *   - L1 block target (current Minima block difficulty): hash < blockTarget
 *
 * The loop stops as soon as the admission target is satisfied, unless the same
 * search already discovered a block-target winner. Ordinary admission proofs
 * stay off-chain; only genuine L1 winners are broadcast via the injected
 * template provider.
 */

import { sha3_256 } from '@totemsdk/core';
import { mineHeaderTail } from '../mine.js';
import { computeActionCommitment } from './commitment.js';
import {
  buildBlockHeaderTail,
  buildEmptyBlockBody,
  assembleTxPoWEnvelope,
  isBlockWinner,
  computeSuperLevel,
} from './template.js';
import {
  MACHINE_WORK_ADMISSION_VERSION,
  type MachineWorkAction,
  type MachineWorkAdmissionProof,
  type MinimaWorkRelay,
  type MinimaWorkTemplate,
  type MinimaWorkTemplateProvider,
  type WorkChallenge,
} from './types.js';

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

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
   * Deterministic 32-byte PRNG for the TxBody (testing only). When omitted a
   * cryptographically random PRNG is generated.
   */
  prng?: Uint8Array;
  /**
   * Optional Minima block relay. When supplied AND the provider also supplies
   * `getLatestTemplate`, a genuine current Minima block is submitted through
   * the relay exactly once. The relay boundary keeps Minima networking out of
   * core mining logic. Either `relay` or `provider.broadcastBlockCandidate`
   * may be used; the relay is the preferred future port.
   */
  relay?: MinimaWorkRelay;
}

/**
 * Mine a Machine Work Admission proof.
 *
 * The admission target is derived from `challenge.target` — the challenge is
 * the single authoritative source. The miner searches the nonce space of a
 * real Minima block candidate (from the injected template provider) whose
 * customHash commits to the action.
 *
 * @param action           The application action.
 * @param challenge        The receiver-issued challenge (target is authoritative).
 * @param templateProvider Injected provider for the current Minima template.
 * @param options          Mining options.
 */
export async function mineWorkAdmission(
  action: MachineWorkAction,
  challenge: WorkChallenge,
  templateProvider: MinimaWorkTemplateProvider,
  options?: MineWorkAdmissionOptions
): Promise<MachineWorkAdmissionProof> {
  const template = await templateProvider.getCurrentTemplate();
  if (templateProvider.validateTemplate) {
    const ok = await templateProvider.validateTemplate(template);
    if (!ok) throw new Error('Minima work template failed validation');
  }

  const actionCommitment = computeActionCommitment(action, challenge);
  const admissionTarget = challenge.target;
  const admissionTargetBytes = hexToBytes(admissionTarget);
  const blockTargetBytes = hexToBytes(template.blockDifficulty);

  // The admission target must be easier than or equal to the block target,
  // otherwise the search would be chasing a block that can never admit.
  if (!isLessThanOrEqual(blockTargetBytes, admissionTargetBytes)) {
    throw new Error(
      'challenge.target must be easier than or equal to the current block target'
    );
  }

  // Build the complete block candidate: empty TxBody (same shape Minima's
  // MINEPULSE automine uses) + header tail with the action commitment.
  const prng = options?.prng ?? randomBytes(32);
  const bodyBytes = buildEmptyBlockBody(prng, template.blockDifficulty);
  const bodyHash = toHex(sha3_256(bodyBytes));

  const timeMilli = options?.timeMilli ?? template.timeMilli;
  const headerTail = buildBlockHeaderTail(template, actionCommitment, bodyHash);

  // Mine against the admission target. The same nonce search also checks the
  // block target: if the winning hash beats the block target, it is a block.
  const result = await mineHeaderTail(headerTail, admissionTargetBytes, {
    signal: options?.signal,
    maxIterations: options?.maxIterations,
    chunkSize: options?.chunkSize,
    timeMilli,
    forceJs: options?.forceJs,
    _skipWorker: options?._skipWorker,
  });

  // Assemble the complete Minima TxPoW wire format (header | 0x01 | body).
  const envelope = assembleTxPoWEnvelope(result.minedHeaderBytes, bodyBytes);

  // Exact Minima-derived metadata.
  const superLevel = computeSuperLevel(result.txpowId, template.blockDifficulty);
  const isBlock = superLevel >= 0;

  const proof: MachineWorkAdmissionProof = {
    version: MACHINE_WORK_ADMISSION_VERSION,
    actionCommitment,
    challengeId: challenge.challengeId,
    admissionTarget,
    txpow: toHex(result.minedHeaderBytes),
    txpowEnvelope: toHex(envelope),
    txpowId: toHex(result.txpowId),
    nonce: result.nonce.toString(),
    minedAt: Date.now(),
    qualifiesForAdmission: true,
    qualifiesAsMinimaBlock: isBlock,
    superLevel,
    isBlock,
    template,
  };

  // Broadcast genuine Minima blocks exactly once, and only if the template is
  // still current. All Super levels (0..31) are eligible — Super level is
  // block strength, NOT a relay policy. Ordinary admission proofs never broadcast.
  if (isBlock) {
    let latest: MinimaWorkTemplate;
    if (templateProvider.getLatestTemplate) {
      latest = await templateProvider.getLatestTemplate();
    } else {
      latest = await templateProvider.getCurrentTemplate();
    }
    if (latest.templateId === template.templateId) {
      if (options?.relay) {
        await options.relay.submitBlock(envelope);
      } else if (templateProvider.broadcastBlockCandidate) {
        await templateProvider.broadcastBlockCandidate(proof);
      }
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

function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  if (typeof crypto === 'undefined' || !crypto.getRandomValues) {
    throw new Error(
      'SECURITY: crypto.getRandomValues unavailable — cannot generate secure random PRNG'
    );
  }
  crypto.getRandomValues(out);
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
