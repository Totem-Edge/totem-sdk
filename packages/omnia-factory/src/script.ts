import { computeScriptAddress } from '@totemsdk/core/scripts';
import { MMRTree, hexToBytes, bytesToHex, serializeMMRProof } from '@totemsdk/core';
import type { FactoryParticipant } from './types.js';

/**
 * Normalize a hex public key digest to the KISSVM-compatible format:
 * strip leading 0x/0X and render as upper-case hex with leading '0X'.
 */
function kissHex(hex: string): string {
  const raw = hex.startsWith('0x') || hex.startsWith('0X') ? hex.slice(2) : hex;
  return '0X' + raw.toUpperCase();
}

/** Blocks after the funding tip at which the unilateral escape opens. */
export const FACTORY_ESCAPE_DELAY_BLOCKS = 256;

/** State port carrying the absolute escape block (STATE(103)). */
export const FACTORY_ESCAPE_PORT = 103;

/**
 * State port carrying the committed party-set root (STATE(111)) — the MMR root
 * of the participant public-key digests (RFC-048 §12.4/§12.5). It is pinned on
 * every spend (`SAMESTATE`), so the participant set is cryptographically fixed
 * and immutable, independent of the per-party enumeration. This is the factory's
 * adoption of the VTXO committed-set root and the anchor for future per-leaf
 * (proof-based) scaling.
 */
export const FACTORY_PARTY_ROOT_PORT = 111;

/** Public-key digests for the party set, padded to a power of two (Minima MMR). */
function padPartySet(participants: FactoryParticipant[]): Uint8Array[] {
  if (!Array.isArray(participants) || participants.length === 0) {
    throw new Error('factory party set requires at least one participant');
  }
  const pubkeys = participants.map((p, i) => {
    const raw = (p.publicKeyDigest ?? '').replace(/^0x/i, '');
    if (raw.length === 0 || !/^[0-9a-fA-F]+$/.test(raw)) {
      throw new Error(`participant[${i}].publicKeyDigest must be a hex string`);
    }
    return hexToBytes(raw);
  });
  let size = 1;
  while (size < pubkeys.length) size <<= 1;
  while (pubkeys.length < size) pubkeys.push(new Uint8Array(32));
  return pubkeys;
}

/** MMR root (hex, no `0x`) over the participants' public-key digests.
 *
 *  Minima's `MMRTree` builds a perfect binary tree (power-of-two leaves), so the
 *  party set is padded to the next power of two with the **zero digest** sentinel
 *  (a fixed, publicly known padding leaf). The root is thus a Minima-native MMR
 *  root — the same structure the VTXO batch root commits and the on-chain `PROOF`
 *  verifies — over an arbitrary number of participants.
 */
export function factoryPartySetRoot(participants: FactoryParticipant[]): string {
  const root = MMRTree.fromPublicKeys(padPartySet(participants)).getRoot();
  if (!root) throw new Error('factoryPartySetRoot: failed to compute the party-set root');
  return bytesToHex(root.data).toLowerCase();
}

/**
 * Serialized MMR inclusion proof (hex, no `0x`) for participant `index` against
 * the committed party-set root — the witness for a per-leaf
 * `buildMmrMembershipCovenant` escape (RFC-048 §12.4).
 */
export function factoryPartyProof(participants: FactoryParticipant[], index: number): string {
  if (!Number.isInteger(index) || index < 0 || index >= participants.length) {
    throw new Error(`factoryPartyProof: index ${index} is out of range (0..${participants.length - 1})`);
  }
  const proof = MMRTree.fromPublicKeys(padPartySet(participants)).getProof(index);
  return bytesToHex(serializeMMRProof(proof)).toLowerCase();
}

/** Committed party-set root state variable (STATE(111)) for the factory funding output. */
export function factoryPartyRootStateVariable(root: string): { port: number; value: string; type: 'hex' } {
  const raw = root.replace(/^0x/i, '');
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error(`factoryPartyRootStateVariable: root must be 32 bytes of hex; got ${JSON.stringify(root)}`);
  }
  return { port: FACTORY_PARTY_ROOT_PORT, value: '0x' + raw, type: 'hex' };
}

/** State port base for per-party allocations: party k ⇒ `base + k` (below the MSHS floor). */
export const FACTORY_BALANCE_PORT_BASE = 128;

/** Lowest port reserved for MSHS-2 (MASH); Omnia ports MUST stay below this.
 *  The node installs the MASH authorization bundle at ports **230–255**
 *  (`bundleBase = 256 − (4 + k) = 230`): the header R / ROOTS_BLOB /
 *  SECRETS_BLOB / TREE_SIG at 230–233 and PROOF at 234–255. A composite
 *  MASH + Omnia coin must therefore keep Omnia ports ≤ 229. */
export const MSHS_PORT_FLOOR = 230;

/** Maximum participants whose balance ports remain below the MSHS floor. */
export const FACTORY_MAX_PARTICIPANTS = MSHS_PORT_FLOOR - FACTORY_BALANCE_PORT_BASE;

export interface FactoryScriptOptions {
  /** Reserved for callers; the escape block is carried in STATE(103) at funding. */
  escapeBlock?: number;
}

/**
 * Per-party allocation state variables (port base+k = party k's balance), seeded
 * into the factory funding output so the timeout escape can pay each party its
 * committed share.
 */
export function factoryBalanceStateVariables(
  participants: FactoryParticipant[],
): { port: number; value: bigint; type: 'number' }[] {
  return participants.map((p, k) => ({
    port: FACTORY_BALANCE_PORT_BASE + k,
    value: p.contributionAmount,
    type: 'number' as const,
  }));
}

/** Absolute escape-block state variable (STATE(103)) for the factory funding output. */
export function factoryEscapeStateVariable(escapeBlock: number): { port: number; value: bigint; type: 'number' } {
  if (!Number.isInteger(escapeBlock) || escapeBlock < 0) {
    throw new Error(`escapeBlock must be a non-negative integer, got ${JSON.stringify(escapeBlock)}`);
  }
  return { port: FACTORY_ESCAPE_PORT, value: BigInt(escapeBlock), type: 'number' as const };
}

/**
 * Build the N-of-N MULTISIG MAST funding script for a channel factory
 * (RFC-039, CUSTODY-POLICY §2).
 *
 * Spend paths:
 *   - **Cooperative / update** (any time): `MULTISIG(N …)` — all parties sign.
 *     `SETTLEMENT=true` closes after minimal coinage (1 block).
 *   - **Unilateral escape** (after the absolute block in `STATE(103)`): any
 *     single party k may withdraw its allocation `SHARE_k = PREVSTATE(base+k)`
 *     (the spent coin's share) to its own settlement address, zero its state in
 *     the successor (`STATE(base+k) EQ 0`), keep the other parties' balances
 *     unchanged, and return the remainder to the factory script. Repeated
 *     withdrawals cannot double-claim because each zeroes its own port. `STATE(103)` is immutable on every spend (`SAMESTATE(103 103)`),
 *     so the escape clock cannot be pushed by any counterparty.
 *
 * Minimum 2 participants required.
 */
export function buildFactoryScript(
  participants: FactoryParticipant[],
  _options: FactoryScriptOptions = {},
): string {
  if (participants.length < 2) {
    throw new Error(`Factory requires at least 2 participants, got ${participants.length}`);
  }
  if (participants.length > FACTORY_MAX_PARTICIPANTS) {
    throw new Error(
      `Factory supports at most ${FACTORY_MAX_PARTICIPANTS} participants (got ${participants.length}) — balance ports would reach the MSHS-2 band (≥${MSHS_PORT_FLOOR})`,
    );
  }
  const count = participants.length;

  const pks = participants.map((p) => kissHex(p.publicKeyDigest));
  const payouts = participants.map((p) => kissHex(p.settlementAddress ?? p.publicKeyDigest));

  const lines: string[] = [
    'LET SETTLEMENT=STATE(100)',
    `ASSERT SAMESTATE(${FACTORY_ESCAPE_PORT} ${FACTORY_ESCAPE_PORT})`,
    // RFC-048 §12.4/§12.5: the committed party-set root is immutable on every spend.
    `ASSERT SAMESTATE(${FACTORY_PARTY_ROOT_PORT} ${FACTORY_PARTY_ROOT_PORT})`,
    `IF @BLOCK GT PREVSTATE(${FACTORY_ESCAPE_PORT}) THEN`,
  ];

  participants.forEach((_, k) => {
    const port = FACTORY_BALANCE_PORT_BASE + k;
    lines.push(`  LET SHARE${k}=PREVSTATE(${port})`);
    lines.push(`  IF SIGNEDBY(${pks[k]}) THEN`);
    lines.push(`    IF SHARE${k} GT 0 THEN`);
    lines.push(`      ASSERT VERIFYOUT(0 ${payouts[k]} SHARE${k} @TOKENID FALSE)`);
    for (let j = 0; j < count; j++) {
      if (j === k) continue;
      lines.push(`      ASSERT STATE(${FACTORY_BALANCE_PORT_BASE + j}) EQ PREVSTATE(${FACTORY_BALANCE_PORT_BASE + j})`);
    }
    lines.push(`      ASSERT STATE(${port}) EQ 0`);
    // Whole-share guard (mirrors the VTXO script): when the withdrawing party's
    // share is the entire output there is no remainder, so a 0-amount output is
    // never required.
    lines.push(`      IF @AMOUNT GT SHARE${k} THEN`);
    lines.push(`        RETURN VERIFYOUT(1 @ADDRESS @AMOUNT SUB SHARE${k} @TOKENID TRUE)`);
    lines.push('      ENDIF');
    lines.push('      RETURN TRUE');
    lines.push('    ENDIF');
    lines.push('  ENDIF');
  });

  lines.push('ENDIF');
  lines.push(`ASSERT MULTISIG(${count} ${pks.join(' ')})`);
  lines.push('IF SETTLEMENT THEN');
  lines.push('    IF @COINAGE GTE 1 THEN RETURN TRUE ENDIF');
  lines.push('ELSE');
  lines.push('    RETURN TRUE');
  lines.push('ENDIF');

  return lines.join('\n');
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
export function buildAndHashFactoryScript(
  participants: FactoryParticipant[],
  options: FactoryScriptOptions = {},
): {
  script: string;
  address: string;
} {
  const script = buildFactoryScript(participants, options);
  const address = scriptAddress(script);
  return { script, address };
}
