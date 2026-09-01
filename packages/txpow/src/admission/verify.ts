/**
 * admission/verify.ts — Machine Work Admission verification.
 *
 * Verification NEVER trusts sender-reported hardware speed or self-reported
 * block metadata (`isBlock`, `superLevel`, `qualifiesAsMinimaBlock`,
 * `broadcastable`). It recomputes the canonical action commitment, re-derives
 * the TxPoW ID from the mined header, and checks `txpowId < challenge.target`.
 * It also checks challenge validity (expiry, recipient, domain) and template
 * freshness.
 *
 * Three distinct claims, never to be confused:
 *   A. valid — the hash satisfies the challenge target.
 *   B. superLevel/isBlock — the exact Minima Super level (-1 or 0..31)
 *      computed from blockDifficulty / txpowId.
 *   C. broadcastable — isBlock AND the template is current AND a live
 *      template provider was supplied.
 *
 * A stale candidate may remain valid = true (and superLevel >= 0) while
 * broadcastable = false. Offline verification (no provider) must NOT claim
 * Minima block contribution — `broadcastable` is left undefined.
 */

import { sha3_256 } from '@totemsdk/core';
import { computeActionCommitment } from './commitment.js';
import { validateWorkChallenge } from './challenge.js';
import { computeSuperLevel, templateFreshness } from './template.js';
import {
  MACHINE_WORK_ADMISSION_VERSION,
  type MachineWorkAction,
  type MachineWorkAdmissionProof,
  type MinimaWorkTemplate,
  type MinimaWorkTemplateProvider,
  type WorkChallenge,
  type WorkAdmissionVerification,
} from './types.js';

function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < h.length; i += 2) {
    out[i / 2] = parseInt(h.slice(i, i + 2), 16);
  }
  return out;
}

/** Big-endian 256-bit comparison: true if a < b. */
function isLessThan(a: Uint8Array, b: Uint8Array): boolean {
  for (let i = 0; i < 32; i++) {
    if (a[i] < b[i]) return true;
    if (a[i] > b[i]) return false;
  }
  return false;
}

export interface VerifyWorkAdmissionOptions {
  /** Override the current time for deterministic testing. */
  now?: number;
  /** Staleness window (ms) within which a template is acceptable for admission. */
  admissionWindowMs?: number;
  /** The latest template, for broadcastability checks. */
  latestTemplate?: MinimaWorkTemplate | null;
}

/**
 * Verify a Machine Work Admission proof.
 *
 * The admission target is taken from the validated challenge — never from the
 * proof. `proof.qualifiesAsMinimaBlock`, `proof.superLevel`, and
 * `proof.isBlock` are treated as derived metadata and are NOT trusted; the
 * Super level is recomputed from the re-derived txpowId and the template's
 * block difficulty.
 *
 * @param action           The application action the proof claims to commit.
 * @param challenge        The challenge the proof claims to satisfy.
 * @param proof            The mined proof.
 * @param templateProvider Optional live provider. When supplied, template
 *                         freshness and broadcastability are checked and
 *                         `broadcastable` is set. When omitted, verification
 *                         runs in offline mode and does NOT claim Minima
 *                         block contribution (`broadcastable` is undefined).
 * @param options          Verification options.
 */
export async function verifyWorkAdmission(
  action: MachineWorkAction,
  challenge: WorkChallenge,
  proof: MachineWorkAdmissionProof,
  templateProvider?: MinimaWorkTemplateProvider,
  options?: VerifyWorkAdmissionOptions
): Promise<WorkAdmissionVerification> {
  // 1. Structural checks
  if (!proof || typeof proof !== 'object') {
    return { valid: false, reason: 'proof is not an object' };
  }
  if (proof.version !== MACHINE_WORK_ADMISSION_VERSION) {
    return { valid: false, reason: `unsupported proof version ${proof.version}` };
  }
  if (proof.challengeId !== challenge.challengeId) {
    return { valid: false, reason: 'proof challengeId does not match challenge' };
  }
  if (proof.qualifiesForAdmission !== true) {
    return { valid: false, reason: 'proof does not claim admission' };
  }
  // Target manipulation guard: the proof must have been mined against the
  // challenge's exact target. A sender must not be able to mine against a
  // trivially easy target and present it as satisfying a harder challenge.
  if (proof.admissionTarget !== challenge.target) {
    return { valid: false, reason: 'proof admissionTarget does not match challenge target' };
  }

  // 2. Challenge validity (expiry, recipient, domain)
  const challengeCheck = validateWorkChallenge(challenge, {
    recipient: action.recipient,
    domain: action.domain,
    now: options?.now,
  });
  if (!challengeCheck.valid) {
    return { valid: false, reason: challengeCheck.reason };
  }

  // 3. Recompute the canonical commitment — must match the proof
  const expectedCommitment = computeActionCommitment(action, challenge);
  if (expectedCommitment !== proof.actionCommitment) {
    return { valid: false, reason: 'action commitment mismatch' };
  }

  // 4. Re-derive the TxPoW ID from the mined header and check the target
  const headerBytes = hexToBytes(proof.txpow);
  const txpowId = sha3_256(headerBytes);
  const txpowIdHex = toHex(txpowId);
  if (txpowIdHex !== proof.txpowId) {
    return { valid: false, reason: 'txpowId does not match mined header' };
  }
  const admissionTarget = hexToBytes(proof.admissionTarget);
  if (!isLessThan(txpowId, admissionTarget)) {
    return { valid: false, reason: 'txpowId does not beat admission target' };
  }

  // 5. Template freshness for admission
  const freshness = templateFreshness(proof.template, options?.latestTemplate ?? null, {
    admissionWindowMs: options?.admissionWindowMs,
    now: options?.now,
  });
  if (!freshness.admissionValid) {
    return { valid: false, reason: 'proof template is stale for admission' };
  }

  // 6. Level B: independently recompute the exact Minima Super level. Never
  //    trust proof.superLevel / proof.isBlock / proof.qualifiesAsMinimaBlock.
  const superLevel = computeSuperLevel(txpowId, proof.template.blockDifficulty);
  const isBlock = superLevel >= 0;

  // 7. Level C: broadcastability requires a live template provider AND a
  //    current template. Offline mode leaves broadcastable undefined.
  let broadcastable: boolean | undefined;
  if (templateProvider) {
    let latest: MinimaWorkTemplate;
    if (templateProvider.getLatestTemplate) {
      latest = await templateProvider.getLatestTemplate();
    } else if (options?.latestTemplate) {
      latest = options.latestTemplate;
    } else {
      latest = await templateProvider.getCurrentTemplate();
    }
    broadcastable = isBlock && latest.templateId === proof.template.templateId;
  }

  return { valid: true, superLevel, isBlock, broadcastable };
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}
