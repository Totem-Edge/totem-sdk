import { computeScriptAddress } from '@totemsdk/core';
import type { ChannelParticipant } from './types.js';

const COINID_ELTOO = '0x01';
const ELTOO_CONTEST_DELAY_BLOCKS = 256;

function kissHex(hex: string): string {
  const raw = hex.startsWith('0x') || hex.startsWith('0X') ? hex.slice(2) : hex;
  // RFC-020 H9: a public-key digest is exactly 64 hex chars. Without this check
  // a digest carrying newlines/opcodes would be interpolated into the script and
  // could alter the `MULTISIG(2 …)` control flow.
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error(`publicKeyDigest must be exactly 64 hex characters, got ${JSON.stringify(hex)}`);
  }
  return '0X' + raw.toUpperCase();
}

/**
 * Eltoo channel script (RFC-044, CUSTODY-POLICY §2).
 *
 * Two spend paths:
 *   - **Update** (`SETTLEMENT` false): `MULTISIG(2 A B)` + `SEQUENCE GT
 *     PREVSEQUENCE` — the optimistic off-chain state advance (both sign).
 *   - **Settlement** (`SETTLEMENT` true): after `@COINAGE GTE
 *     ELTOO_CONTEST_DELAY_BLOCKS`, **either party alone** may spend
 *     (`IF SIGNEDBY(A) … RETURN SIGNEDBY(B)`) the pre-signed latest state. This
 *     is the unilateral close: an unresponsive peer can no longer strand funds.
 *
 * Non-custodial: a party broadcasts the pre-signed latest state and exits after
 * the contest delay without the counterparty's signature or liveness.
 */
export function buildEltooScript(parties: ChannelParticipant[]): string {
  if (parties.length !== 2) {
    throw new Error(`v0.1.0 supports exactly 2 parties, got ${parties.length}`);
  }
  const [a, b] = parties;
  const pkA = kissHex(a.publicKeyDigest);
  const pkB = kissHex(b.publicKeyDigest);

  const script = [
    'LET SETTLEMENT=STATE(100)',
    'LET SEQUENCE=STATE(101)',
    'LET PREVSEQUENCE=PREVSTATE(101)',
    `LET BOTHSIGNED=MULTISIG(2 ${pkA} ${pkB})`,
    'IF SETTLEMENT THEN',
    '    ASSERT SEQUENCE EQ PREVSEQUENCE',
    `    ASSERT @COINAGE GTE ${ELTOO_CONTEST_DELAY_BLOCKS}`,
    // Unilateral close: either party may broadcast the pre-signed latest state
    // after the contest delay — no counterparty signature or liveness required.
    `    IF SIGNEDBY(${pkA}) THEN RETURN TRUE ENDIF`,
    `    RETURN SIGNEDBY(${pkB})`,
    'ENDIF',
    'ASSERT BOTHSIGNED',
    'ASSERT SEQUENCE GT PREVSEQUENCE',
    'RETURN TRUE',
  ].join('\n');

  return script;
}

export function normalizeScript(script: string): string {
  return script.trim().toUpperCase();
}

export function scriptAddress(script: string): string {
  return computeScriptAddress(script);
}

export function buildAndHashEltooScript(parties: ChannelParticipant[]): { script: string; address: string } {
  const script = buildEltooScript(parties);
  const address = scriptAddress(script);
  return { script, address };
}

export { COINID_ELTOO, ELTOO_CONTEST_DELAY_BLOCKS };
