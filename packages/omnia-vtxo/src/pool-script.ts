/**
 * VTXO pool on-chain script (RFC-038 V1).
 *
 * The pool is an on-chain state output holding `totalCapacity`; an epoch's batch
 * root is committed as STATE(100) with the epoch number in STATE(101), and the
 * update requires a strictly-greater epoch (`ASSERT EPOCH GT PREVSTATE(101)`) so a
 * old root cannot be re-anchored (RFC-038 §5 "stale/rolled-back root").
 *
 * CUSTODY NOTE: this script is currently **operator-only** (`SIGNEDBY(operator)`),
 * so until V2 lands the owner-unilateral timelock branch the pool output is
 * custodied by the operator on-chain. This is surfaced in RFC-038 §3.3/§5.
 */

import { computeScriptAddress } from '@totemsdk/core';

function operatorPkHex(operatorPublicKeyDigest: string): string {
  const raw = operatorPublicKeyDigest.replace(/^0x/i, '');
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error(`operator public key digest must be 64 hex chars, got ${JSON.stringify(operatorPublicKeyDigest)}`);
  }
  return '0X' + raw.toUpperCase();
}

/** Operator-controlled, epoch-monotone state-carrying pool script. */
export function buildPoolScript(operatorPublicKeyDigest: string): string {
  return [
    'LET ROOT=STATE(100)',
    'LET EPOCH=STATE(101)',
    'ASSERT EPOCH GT PREVSTATE(101)',
    `RETURN SIGNEDBY(${operatorPkHex(operatorPublicKeyDigest)})`,
  ].join('\n');
}

export function poolScriptAddress(script: string): string {
  return computeScriptAddress(script);
}

export function buildAndHashPoolScript(operatorPublicKeyDigest: string): { script: string; address: string } {
  const script = buildPoolScript(operatorPublicKeyDigest);
  return { script, address: poolScriptAddress(script) };
}
