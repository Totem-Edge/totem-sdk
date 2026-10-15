/**
 * VTXO pool on-chain script (RFC-038 V1).
 *
 * The pool is an on-chain state output holding `totalCapacity`; an epoch's batch
 * root is committed as STATE(100) with the epoch number in STATE(101). The output
 * is spendable by the operator (batch updates); the owner timelock exit path is
 * V2.
 */

import { computeScriptAddress } from '@totemsdk/core';

function operatorPkHex(operatorPublicKeyDigest: string): string {
  const raw = operatorPublicKeyDigest.replace(/^0x/i, '');
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error(`operator public key digest must be 64 hex chars, got ${JSON.stringify(operatorPublicKeyDigest)}`);
  }
  return '0X' + raw.toUpperCase();
}

/** Operator-controlled state-carrying pool script. */
export function buildPoolScript(operatorPublicKeyDigest: string): string {
  return [
    'LET ROOT=STATE(100)',
    'LET EPOCH=STATE(101)',
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
