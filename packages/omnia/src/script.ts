import { computeScriptAddress, toNodeScript } from '@totemsdk/core';
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
  return '0x' + raw.toUpperCase();
}

/**
 * Eltoo channel script (RFC-039, CUSTODY-POLICY §2).
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
 *
 * The settlement `@COINAGE GTE ELTOO_CONTEST_DELAY_BLOCKS` is a *relative* contest
 * delay and is deliberately not converted to an absolute `@BLOCK`: each update
 * resets it by design. It cannot be weaponised to push the victim's clock because
 * both update and settlement require `BOTHSIGNED` — no one can move the coin to
 * reset coinage without the victim's signature.
 */
export function buildEltooScript(
  parties: ChannelParticipant[],
  contestDelayBlocks: number | bigint = ELTOO_CONTEST_DELAY_BLOCKS,
): string {
  if (!Array.isArray(parties)) {
    throw new Error(`parties must be an array of channel participants, got ${parties === null ? 'null' : typeof parties}`);
  }
  if (parties.length !== 2) {
    throw new Error(`v0.1.0 supports exactly 2 parties, got ${parties.length}`);
  }
  parties.forEach((party, index) => {
    if (typeof party !== 'object' || party === null) {
      throw new Error(`parties[${index}] must be a channel participant object`);
    }
    if (typeof party.publicKeyDigest !== 'string') {
      throw new Error(`parties[${index}].publicKeyDigest must be a 64-hex string`);
    }
  });
  // Block heights are bigint elsewhere in the SDK; accept either here and emit a
  // decimal number so the script stays indexable by the node.
  const delay = typeof contestDelayBlocks === 'bigint' ? Number(contestDelayBlocks) : contestDelayBlocks;
  if (!Number.isSafeInteger(delay) || delay < 0) {
    throw new Error(`contestDelayBlocks must be a safe non-negative integer, got ${String(contestDelayBlocks)}`);
  }
  const [a, b] = parties;
  const pkA = kissHex(a.publicKeyDigest);
  const pkB = kissHex(b.publicKeyDigest);
  if (pkA === pkB) {
    // MULTISIG(2 A A) is satisfiable by a single signature of A, so a duplicate
    // key silently collapses the 2-of-2 spend constraint to 1-of-1.
    throw new Error('parties must have distinct publicKeyDigest values; a duplicate key collapses MULTISIG(2) to 1-of-1');
  }

  const script = [
    'LET SETTLEMENT=STATE(100)',
    'LET SEQUENCE=STATE(101)',
    'LET PREVSEQUENCE=PREVSTATE(101)',
    `LET BOTHSIGNED=MULTISIG(2 ${pkA} ${pkB})`,
    'IF SETTLEMENT THEN',
    '    ASSERT BOTHSIGNED',
    '    ASSERT SEQUENCE EQ PREVSEQUENCE',
    `    ASSERT @COINAGE GTE ${delay}`,
    '    RETURN TRUE',
    'ENDIF',
    'ASSERT BOTHSIGNED',
    'ASSERT SEQUENCE GT PREVSEQUENCE',
    'RETURN TRUE',
  ].join('\n');

  return toNodeScript(script);
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
