import { computeScriptAddress } from '@totemsdk/core';
import type { FactoryParticipant } from './types.js';

/**
 * Normalize a hex public key digest to the KISSVM-compatible format:
 * strip leading 0x/0X and render as upper-case hex with leading '0X'.
 */
function kissHex(hex: string): string {
  const raw = hex.startsWith('0x') || hex.startsWith('0X') ? hex.slice(2) : hex;
  return '0X' + raw.toUpperCase();
}

/**
 * Build the N-of-N MULTISIG MAST funding script for a channel factory.
 *
 * Spending rules:
 *   - Any cooperative close (SETTLEMENT=true): all N parties sign, spend after
 *     minimal coinage (1 block) so the factory can be closed immediately after
 *     a confirmed update.
 *   - Non-settlement path: all N parties must still sign (ASSERT MULTISIG(N ...))
 *     but can spend in the same block (no coinage requirement) — used for future
 *     optimistic factory updates if desired.
 *
 * `storestate=true` is achieved by encoding STATE(100) in the output state
 * variables of every factory TX.
 *
 * Minimum 2 participants required.
 */
export function buildFactoryScript(participants: FactoryParticipant[]): string {
  if (participants.length < 2) {
    throw new Error(`Factory requires at least 2 participants, got ${participants.length}`);
  }
  const n = participants.length;
  const pks = participants.map(p => kissHex(p.publicKeyDigest)).join(' ');

  return [
    'LET SETTLEMENT=STATE(100)',
    `ASSERT MULTISIG(${n} ${pks})`,
    'IF SETTLEMENT THEN',
    '    IF @COINAGE GTE 1 THEN RETURN TRUE ENDIF',
    'ELSE',
    '    RETURN TRUE',
    'ENDIF',
  ].join('\n');
}

export function normalizeScript(script: string): string {
  return script.trim().toUpperCase();
}

/** Compute the SHA3-256 script-hash address for a factory script. */
export function scriptAddress(script: string): string {
  return computeScriptAddress(script);
}

/**
 * Build the factory script and compute its canonical address in one step.
 * The address is used as the output address of the factory funding TX.
 */
export function buildAndHashFactoryScript(participants: FactoryParticipant[]): {
  script: string;
  address: string;
} {
  const script = buildFactoryScript(participants);
  const address = scriptAddress(script);
  return { script, address };
}
