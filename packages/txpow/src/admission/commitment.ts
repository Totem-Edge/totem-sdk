/**
 * admission/commitment.ts — Canonical domain-separated action commitment.
 *
 * The commitment is a deterministic SHA3-256 over a length-prefixed canonical
 * encoding of every security-relevant field. It changes if any of the
 * following change:
 *   - protocol domain / version
 *   - action domain, sender, recipient, actionId, payloadHash, context
 *   - challenge challengeId, nonce, target, expiresAt
 *
 * The resulting 32-byte commitment is placed in the TxPoW header's customHash
 * field, so the mined nonce commits the work to sender, recipient, action,
 * challenge, target, and freshness.
 */

import { sha3_256 } from '@totemsdk/core';
import {
  MACHINE_WORK_ADMISSION_VERSION,
  MACHINE_WORK_DOMAIN,
  type MachineWorkAction,
  type WorkChallenge,
} from './types.js';
import { canonicalChallenge } from './challenge.js';

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Canonical serialization of a MachineWorkAction.
 *
 * Length-prefixed fields in a fixed order; context keys are sorted so that
 * equivalent input produces identical output.
 */
export function canonicalAction(action: MachineWorkAction): string {
  const parts: string[] = [];
  const push = (s: string): void => {
    parts.push(String(s.length).padStart(8, '0'));
    parts.push(s);
  };
  push('totem.machine-work-action');
  push(String(action.version));
  push(action.domain);
  push(action.sender);
  push(action.recipient);
  push(action.actionId);
  push(action.payloadHash);
  if (action.context) {
    const keys = Object.keys(action.context).sort();
    for (const key of keys) {
      push(key);
      push(action.context[key]);
    }
  }
  return parts.join('');
}

/**
 * Compute the canonical action commitment.
 *
 * commitment = SHA3-256(
 *   protocolDomain || protocolVersion ||
 *   canonicalAction(action) || canonicalChallenge(challenge)
 * )
 *
 * @param action    The application action.
 * @param challenge The challenge the work is bound to.
 */
export function computeActionCommitment(
  action: MachineWorkAction,
  challenge: WorkChallenge
): string {
  const input =
    MACHINE_WORK_DOMAIN +
    '|' +
    String(MACHINE_WORK_ADMISSION_VERSION) +
    '|' +
    canonicalAction(action) +
    '|' +
    canonicalChallenge(challenge);
  return toHex(sha3_256(new TextEncoder().encode(input)));
}
