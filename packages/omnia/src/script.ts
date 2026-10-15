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
 * Two spend paths, **both requiring `MULTISIG(2 A B)`**:
 *   - **Update** (`SETTLEMENT` false): `BOTHSIGNED` + `SEQUENCE GT
 *     PREVSEQUENCE` — advance the off-chain state.
 *   - **Settlement** (`SETTLEMENT` true): `BOTHSIGNED` + `SEQUENCE EQ
 *     PREVSEQUENCE` after `@COINAGE GTE ELTOO_CONTEST_DELAY_BLOCKS` — close on the
 *     pre-signed state.
 *
 * Unilateral close is achieved by **broadcasting the co-signed close package**:
 * each state carries an update + settlement transaction pre-signed by *both*
 * parties (`settlement.ts` `startUnilateralClose`/`finalizeUnilateralClose`), and
 * because the witness already contains both signatures, *either party can relay
 * it alone* — no counterparty liveness. `BOTHSIGNED` here is therefore the output
 * constraint: only a transaction both parties signed (the agreed split) can be
 * spent. A single-signer settlement branch would let one party pay itself
 * everything, so it must never be added without an explicit output constraint.
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
    '    ASSERT BOTHSIGNED',
    '    ASSERT SEQUENCE EQ PREVSEQUENCE',
    `    ASSERT @COINAGE GTE ${ELTOO_CONTEST_DELAY_BLOCKS}`,
    '    RETURN TRUE',
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
