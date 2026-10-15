/**
 * VTXO pool on-chain script (RFC-038 V2 — non-custodial).
 *
 * The pool is an on-chain state output holding `totalCapacity`. An epoch's batch
 * root is committed as STATE(100), the epoch number in STATE(101), and the
 * owner's absolute exit-eligibility block in STATE(102).
 *
 * Custody (RFC-039 / CUSTODY-POLICY §2):
 *   - **Unilateral owner exit.** After `@BLOCK GT EXITBLOCK` the owner alone may
 *     spend (`RETURN SIGNEDBY(OWNER)`) — no operator signature or liveness. This
 *     is exercised by the pre-signed exit tx (`exit-tx.ts`).
 *   - **Cooperative update.** Before the exit window the pool may only move by
 *     `MULTISIG(2 OPERATOR OWNER)`, epoch-monotone (`ASSERT EPOCH GT
 *     PREVSTATE(101)`), with the exit block immutable (`ASSERT SAMESTATE(102
 *     102)`) so the operator can never push the owner's escape clock, and the
 *     value confined to the same script address (`ASSERT VERIFYOUT(@INPUT
 *     @ADDRESS @AMOUNT @TOKENID TRUE)`) so the operator can never pay itself.
 *
 * The operator holds no unilateral path: it cannot move funds, cannot advance
 * the exit block, and cannot stop the owner's exit. It is a liveness-only peer.
 */

import { computeScriptAddress } from '@totemsdk/core';

export interface PoolScriptParams {
  /** Operator WOTS public-key digest (64 hex). */
  operatorPublicKeyDigest: string;
  /** Pool owner WOTS public-key digest (64 hex). */
  ownerPublicKeyDigest: string;
  /** Absolute block height after which the owner may exit unilaterally. */
  exitBlock: number;
}

function pkHex(digest: string, label: string): string {
  const raw = digest.replace(/^0x/i, '');
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error(`${label} public key digest must be 64 hex chars, got ${JSON.stringify(digest)}`);
  }
  return '0X' + raw.toUpperCase();
}

/** Non-custodial, epoch-monotone, owner-escapable state-carrying pool script. */
export function buildPoolScript(params: PoolScriptParams): string {
  const owner = pkHex(params.ownerPublicKeyDigest, 'owner');
  const operator = pkHex(params.operatorPublicKeyDigest, 'operator');
  if (!Number.isInteger(params.exitBlock) || params.exitBlock < 0) {
    throw new Error(`exitBlock must be a non-negative integer, got ${JSON.stringify(params.exitBlock)}`);
  }

  return [
    'LET EPOCH=STATE(101)',
    'LET EXITBLOCK=STATE(102)',
    'IF @BLOCK GT EXITBLOCK THEN',
    `  RETURN SIGNEDBY(${owner})`,
    'ENDIF',
    'ASSERT EPOCH GT PREVSTATE(101)',
    'ASSERT SAMESTATE(102 102)',
    'ASSERT VERIFYOUT(@INPUT @ADDRESS @AMOUNT @TOKENID TRUE)',
    `RETURN MULTISIG(2 ${operator} ${owner})`,
  ].join('\n');
}

export function poolScriptAddress(script: string): string {
  return computeScriptAddress(script);
}

export function buildAndHashPoolScript(params: PoolScriptParams): { script: string; address: string } {
  const script = buildPoolScript(params);
  return { script, address: poolScriptAddress(script) };
}
