import { computeScriptAddress } from '@totemsdk/core/scripts';
import { sha3_256 } from '@totemsdk/core';
import { MINIMA_DECIMALS, MMRTree, hexToBytes, bytesToHex, serializeMMRProof, createMMRDataLeafNode, toNodeScript, wotsAddressData } from '@totemsdk/core';
import type { FactoryParticipant } from './types.js';

/**
 * Normalize a hex public key digest to the KISSVM-compatible format:
 * strip leading 0x/0X and render as upper-case hex with a lowercase 0x prefix.
 */
function kissHex(hex: string): string {
  const raw = hex.startsWith('0x') || hex.startsWith('0X') ? hex.slice(2) : hex;
  return '0x' + raw.toUpperCase();
}

/** Blocks after the funding tip at which the unilateral escape opens. */
export const FACTORY_ESCAPE_DELAY_BLOCKS = 256;

/** State port carrying the absolute escape block (STATE(103)). */
export const FACTORY_ESCAPE_PORT = 103;

/**
 * OMN-058/RFC-079 §4: checkpoint sequence (STATE(104)). Seeded at funding and
 * advanced by exactly one on every checkpoint spend, so a checkpoint can never
 * be replayed against a newer state.
 */
export const FACTORY_CHECKPOINT_SEQUENCE_PORT = 104;

/**
 * State port carrying the committed party-set root (STATE(111)) — the MMR root
 * of the participant public-key digests (RFC-048 §12.4/§12.5). It is pinned on
 * every spend (`SAMESTATE`), so the participant set is cryptographically fixed
 * and immutable, independent of the per-party enumeration. This is the factory's
 * adoption of the VTXO committed-set root and the anchor for future per-leaf
 * (proof-based) scaling.
 */
export const FACTORY_PARTY_ROOT_PORT = 111;

/**
 * State port carrying the committed balance set-root (STATE(112)) — the MMR root
 * over `(pubkey, balance)` leaves (RFC-048 §12.4). Pinned on every spend.
 */
export const FACTORY_BALANCE_ROOT_PORT = 112;

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

/**
 * Balance set-root (RFC-048 §12.4) — the MMR root over `(pubkey, balance)` leaves,
 * where each participant's `contributionAmount` is the **leaf sum**. This commits
 * the exact distribution of the factory balance (`rootSum` = the total) and is the
 * scalable, off-chain commitment that replaces per-party balance ports.
 */
export function factoryBalanceSetRoot(participants: FactoryParticipant[]): { root: string; rootSum: bigint } {
  const tree = buildBalanceTree(participants);
  const root = tree.getRoot();
  if (!root) throw new Error('factoryBalanceSetRoot: failed to compute the balance set-root');
  return { root: bytesToHex(root.data).toLowerCase(), rootSum: root.value };
}

/**
 * Serialized MMR inclusion proof (hex, no `0x`) for participant `index` against
 * the committed balance set-root — the witness for a `buildMmrMembershipCovenant`
 * balance escape (leaf sum = the participant's balance).
 */
export function factoryBalanceProof(participants: FactoryParticipant[], index: number): string {
  if (!Number.isInteger(index) || index < 0 || index >= participants.length) {
    throw new Error(`factoryBalanceProof: index ${index} is out of range (0..${participants.length - 1})`);
  }
  const proof = buildBalanceTree(participants).getProof(index);
  return bytesToHex(serializeMMRProof(proof)).toLowerCase();
}

/** Padded (power-of-two) MMR tree over `(pubkey, balance)` leaves. */
function buildBalanceTree(participants: FactoryParticipant[]): MMRTree {
  if (!Array.isArray(participants) || participants.length === 0) {
    throw new Error('factory balance set requires at least one participant');
  }
  const tree = new MMRTree();
  for (const [i, p] of participants.entries()) {
    const raw = (p.publicKeyDigest ?? '').replace(/^0x/i, '');
    if (raw.length === 0 || !/^[0-9a-fA-F]+$/.test(raw)) {
      throw new Error(`participant[${i}].publicKeyDigest must be a hex string`);
    }
    if (p.contributionAmount < 0n) {
      throw new Error(`participant[${i}].contributionAmount must be non-negative`);
    }
    tree.addLeaf(createMMRDataLeafNode(hexToBytes(raw), p.contributionAmount));
  }
  let size = 1;
  while (size < participants.length) size <<= 1;
  for (let i = participants.length; i < size; i++) {
    tree.addLeaf(createMMRDataLeafNode(new Uint8Array(32), 0n));
  }
  return tree;
}

export interface FactoryDistributionOutput {
  /** Payout destination (hex pubkey digest). */
  address: string;
  /** Committed balance (atoms). */
  amount: bigint;
  tokenId: string;
}

/**
 * The exact payout set the pre-signed all-party distribution must contain — one
 * output per participant, paying its committed balance (RFC-048 §12.4). Its sum
 * equals `factoryBalanceSetRoot(...).rootSum`.
 */
export function factoryDistributionOutputs(
  participants: FactoryParticipant[],
  tokenId = '0x00',
): FactoryDistributionOutput[] {
  if (!Array.isArray(participants) || participants.length === 0) {
    throw new Error('factoryDistributionOutputs requires at least one participant');
  }
  return participants.map((p, i) => {
    const raw = (p.settlementAddress ?? p.publicKeyDigest ?? '').replace(/^0x/i, '');
    if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
      throw new Error(`factoryDistributionOutputs: participant[${i}] payout address must be a 64-hex digest`);
    }
    if (p.contributionAmount < 0n) {
      throw new Error(`factoryDistributionOutputs: participant[${i}].contributionAmount must be non-negative`);
    }
    return { address: wotsAddressData(raw), amount: p.contributionAmount, tokenId };
  });
}

export interface FactoryDistributionScriptConfig {
  participants: FactoryParticipant[];
  /** State port carrying the escape block. Default `FACTORY_ESCAPE_PORT` (103). */
  escapePort?: number;
  /** State port carrying the committed party-set root. Default `FACTORY_PARTY_ROOT_PORT` (111). */
  partyRootPort?: number;
  /** State port carrying the committed balance set-root. Default `FACTORY_BALANCE_ROOT_PORT` (112). */
  balanceRootPort?: number;
}

/**
 * Pre-signed all-party distribution (RFC-048 §12.4) — kept as a **separate**
 * mechanism for a dedicated distribution coin.
 *
 * This script authorizes the spend with `MULTISIG` after the escape height. It
 * does **not** verify the payout set; allocation correctness comes from the
 * pre-signed transaction that the parties exchange. Do not describe or use it as
 * an allocation verifier — use `buildFactoryDistributionScript` (output-enforced)
 * or the `settlement: 'full-distribution'` funding branch instead.
 */
export function buildFactoryPresignedDistributionScript(config: FactoryDistributionScriptConfig): string {
  const participants = config.participants;
  if (!Array.isArray(participants) || participants.length < 1) {
    throw new Error('buildFactoryDistributionScript requires at least one participant');
  }
  const pks = participants.map((p, i) => {
    if (!p.publicKeyDigest) throw new Error(`participant[${i}].publicKeyDigest is required`);
    return kissHex(p.publicKeyDigest);
  });
  const escapePort = config.escapePort ?? FACTORY_ESCAPE_PORT;
  const partyRootPort = config.partyRootPort ?? FACTORY_PARTY_ROOT_PORT;
  const balanceRootPort = config.balanceRootPort ?? FACTORY_BALANCE_ROOT_PORT;

  return [
    '// Scalable factory escape — pre-signed all-party distribution (RFC-048 §12.4)',
    `ASSERT SAMESTATE(${escapePort} ${escapePort})`,
    `ASSERT SAMESTATE(${partyRootPort} ${partyRootPort})`,
    `ASSERT SAMESTATE(${balanceRootPort} ${balanceRootPort})`,
    `IF @BLOCK GT PREVSTATE(${escapePort}) THEN`,
    `  ASSERT MULTISIG(${participants.length} ${pks.join(' ')})`,
    `  RETURN TRUE`,
    `ENDIF`,
    `RETURN FALSE`,
  ].join('\n');
}

/**
 * OMN-058/RFC-079 §4A — output-enforced full distribution for a factory coin.
 *
 * After the committed escape block, any participant may settle the factory by
 * paying **every** committed share. The covenant reads the shares from the spent
 * coin (`PREVSTATE`), pins the output count, each destination, each amount and
 * the total, so neither the broadcaster nor an outsider can redirect or resize a
 * payout. One participant signature authorizes the trigger.
 *
 * Use `buildFactoryDistribution` to materialize the matching transaction.
 */
export function buildFactoryDistributionScript(config: FactoryDistributionScriptConfig): string {
  const participants = config.participants;
  if (!Array.isArray(participants) || participants.length < 1) {
    throw new Error('buildFactoryDistributionScript requires at least one participant');
  }
  const pks = participants.map((p, i) => {
    if (!p.publicKeyDigest) throw new Error(`participant[${i}].publicKeyDigest is required`);
    return kissHex(p.publicKeyDigest);
  });
  const payouts = participants.map((p, i) => {
    const raw = (p.settlementAddress ?? p.publicKeyDigest ?? '').replace(/^0x/i, '');
    if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
      throw new Error(`participant[${i}] payout address must be a 64-hex digest`);
    }
    return wotsAddressData(raw);
  });
  const escapePort = config.escapePort ?? FACTORY_ESCAPE_PORT;
  const count = participants.length;

  const lines: string[] = [
    '// Output-enforced factory distribution (OMN-058 / RFC-079 §4A)',
    `IF @BLOCK GT PREVSTATE(${escapePort}) THEN`,
    '  ASSERT @TOTIN EQ 1',
    '  ASSERT @INPUT EQ 0',
    `  ASSERT @TOTOUT EQ ${count}`,
  ];
  const terms = participants.map((_, k) => `PREVSTATE(${FACTORY_BALANCE_PORT_BASE + k})`);
  lines.push(`  ASSERT ${terms.join(' + ')} EQ @AMOUNT`);
  participants.forEach((_, k) => {
    lines.push(`  ASSERT VERIFYOUT(${k} ${payouts[k]} PREVSTATE(${FACTORY_BALANCE_PORT_BASE + k}) @TOKENID FALSE)`);
  });
  lines.push(`  ASSERT (${pks.map((pk) => `SIGNEDBY(${pk})`).join(' OR ')})`);
  lines.push('  RETURN TRUE');
  lines.push('ENDIF');
  lines.push('RETURN FALSE');
  return toNodeScript(lines.join('\n'));
}

/**
 * OMN-060: deterministic party-set root committed by STATE(111).
 * Canonical: parties sorted by id, `id:pubkeyDigest`.
 */
export function computeFactoryPartyRoot(participants: FactoryParticipant[]): string {
  const canonical = [...participants]
    .map((p) => `${p.partyId}:${p.publicKeyDigest.replace(/^0x/i, '').toLowerCase()}`)
    .sort()
    .join('|');
  return '0x' + bytesToHex(sha3_256(new TextEncoder().encode('totemsdk/factory/party-root/v1|' + canonical))).toLowerCase();
}

/** OMN-060: deterministic balance root committed by STATE(112). */
export function computeFactoryBalanceRoot(allocations: Record<string, bigint>): string {
  const canonical = Object.entries(allocations)
    .map(([partyId, amount]) => `${partyId}:${amount.toString()}`)
    .sort()
    .join('|');
  return '0x' + bytesToHex(sha3_256(new TextEncoder().encode('totemsdk/factory/balance-root/v1|' + canonical))).toLowerCase();
}

/** Committed balance-set root state variable (STATE(112)) for the funding output. */
export function factoryBalanceRootStateVariable(root: string): { port: number; value: string; type: 'hex' } {
  const raw = root.replace(/^0x/i, '');
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error(`factoryBalanceRootStateVariable: root must be 32 bytes of hex; got ${JSON.stringify(root)}`);
  }
  return { port: FACTORY_BALANCE_ROOT_PORT, value: '0x' + raw, type: 'hex' };
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
  /**
   * OMN-058 checkpoint mode (RFC-079 §4). When true, the cooperative branch only
   * accepts a same-script, same-value successor whose sequence advanced by one.
   * Every allocation change then has an on-chain artifact, and the unilateral
   * escape pays the latest checkpoint instead of the original funding split.
   *
   * Off by default: the off-chain factory design stays available, with OMN-058
   * open until the contestable protocol lands.
   */
  enforceCheckpoints?: boolean;
  /**
   * OMN-058/RFC-079 §4A: add the output-enforced full-distribution branch.
   * Any participant can settle every committed share in one transaction; the
   * covenant pins each destination, amount, the output count and conservation.
   */
  settlement?: 'per-party' | 'full-distribution';
}

/**
 * Per-party allocation state variables (port base+k = party k's balance), seeded
 * into the factory funding output so the timeout escape can pay each party its
 * committed share.
 */
export function factoryBalanceStateVariables(
  participants: FactoryParticipant[],
): { port: number; value: bigint; type: 'number'; scale: number }[] {
  // OMN-034: these ports are used as exact payout amounts by the unilateral
  // escape script, so they must carry MiniNumber scale 44 like every coin amount.
  return participants.map((p, k) => ({
    port: FACTORY_BALANCE_PORT_BASE + k,
    value: p.contributionAmount,
    type: 'number' as const,
    scale: MINIMA_DECIMALS,
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
 * Build the factory funding script.
 *
 * Spend paths:
 *   - **Cooperative / checkpoint** (any time, all parties): `MULTISIG(N …)`.
 *     With `enforceCheckpoints`, the successor must stay at this script, keep the
 *     value and advance `STATE(104)` by exactly one.
 *   - **Unilateral escape** (after the absolute block in `STATE(103)`): any single
 *     party may withdraw its committed share `PREVSTATE(base+k)` to its own
 *     settlement address. With a remainder, the successor keeps the script, the
 *     other shares are untouched and the withdrawing port is zeroed.
 *   - **Full distribution** (`settlement: 'full-distribution'`, after the same
 *     block): one transaction pays **every** committed share. The covenant pins
 *     the output count, each destination and each amount read from `PREVSTATE`,
 *     so a broadcaster cannot redirect or resize a payout. One participant
 *     signature is enough to trigger it.
 *
 * The escape branches are terminal (no successor state), so the state-continuity
 * assertions live in the cooperative path only.
 *
 * Minimum 2 participants required.
 */
export function buildFactoryScript(
  participants: FactoryParticipant[],
  options: FactoryScriptOptions = {},
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
  const payouts = participants.map((p) => wotsAddressData(p.settlementAddress ?? p.publicKeyDigest));

  const enforceCheckpoints = options.enforceCheckpoints === true;
  const fullDistribution = options.settlement === 'full-distribution';
  const lines: string[] = [
    'LET settlement=STATE(100)',
    `IF @BLOCK GT PREVSTATE(${FACTORY_ESCAPE_PORT}) THEN`,
  ];

  if (fullDistribution) {
    // OMN-058/RFC-079 §4A: output-enforced settlement. Every amount is read from
    // the coin being spent, never from the transaction's own claims.
    lines.push('  // Full distribution: pay every committed share in one transaction.');
    lines.push('  IF @TOTIN EQ 1 THEN');
    lines.push(`    IF @TOTOUT EQ ${count} THEN`);
    // Gate on the last payout address so a per-party escape (which leaves the
    // remainder at the factory script) falls through to its own branch instead
    // of failing this one.
    lines.push(`      IF GETOUTADDR(${count - 1}) EQ ${payouts[count - 1]} THEN`);
    lines.push('        ASSERT @INPUT EQ 0');
    const terms = participants.map((_, k) => `PREVSTATE(${FACTORY_BALANCE_PORT_BASE + k})`);
    lines.push(`        ASSERT ${terms.join(' + ')} EQ @AMOUNT`);
    participants.forEach((_, k) => {
      lines.push(`        ASSERT VERIFYOUT(${k} ${payouts[k]} PREVSTATE(${FACTORY_BALANCE_PORT_BASE + k}) @TOKENID FALSE)`);
    });
    lines.push(`        ASSERT (${pks.map((pk) => `SIGNEDBY(${pk})`).join(' OR ')})`);
    lines.push('        RETURN TRUE');
    lines.push('      ENDIF');
    lines.push('    ENDIF');
    lines.push('  ENDIF');
  }

  participants.forEach((_, k) => {
    const port = FACTORY_BALANCE_PORT_BASE + k;
    lines.push(`  LET share=PREVSTATE(${port})`);
    lines.push(`  IF SIGNEDBY(${pks[k]}) THEN`);
    lines.push('    IF share GT 0 THEN');
    lines.push(`      ASSERT VERIFYOUT(0 ${payouts[k]} share @TOKENID FALSE)`);
    // Whole-share exit: no successor state exists, so no remainder and no state
    // continuity assertions.
    lines.push('      IF @AMOUNT EQ share THEN');
    lines.push('        ASSERT @TOTOUT EQ 1');
    lines.push('        RETURN TRUE');
    lines.push('      ENDIF');
    for (let j = 0; j < count; j++) {
      if (j === k) continue;
      lines.push(`      ASSERT STATE(${FACTORY_BALANCE_PORT_BASE + j}) EQ PREVSTATE(${FACTORY_BALANCE_PORT_BASE + j})`);
    }
    lines.push(`      ASSERT STATE(${port}) EQ 0`);
    lines.push('      RETURN VERIFYOUT(1 @ADDRESS @AMOUNT - share @TOKENID TRUE)');
    lines.push('    ENDIF');
    lines.push('  ENDIF');
  });

  lines.push('ENDIF');
  // Cooperative path: the successor keeps the escape clock and the party set.
  lines.push(`ASSERT SAMESTATE(${FACTORY_ESCAPE_PORT} ${FACTORY_ESCAPE_PORT})`);
  lines.push(`ASSERT SAMESTATE(${FACTORY_PARTY_ROOT_PORT} ${FACTORY_PARTY_ROOT_PORT})`);
  lines.push(`ASSERT MULTISIG(${count} ${pks.join(' ')})`);
  lines.push('IF settlement THEN');
  lines.push('    IF @COINAGE GTE 1 THEN RETURN TRUE ENDIF');
  lines.push('ELSE');
  if (enforceCheckpoints) {
    // Checkpoint continuity: same script, same value, sequence advanced by one.
    lines.push(`    ASSERT STATE(${FACTORY_CHECKPOINT_SEQUENCE_PORT}) EQ INC(PREVSTATE(${FACTORY_CHECKPOINT_SEQUENCE_PORT}))`);
    lines.push('    ASSERT VERIFYOUT(@INPUT @ADDRESS @AMOUNT @TOKENID TRUE)');
  }
  lines.push('    RETURN TRUE');
  lines.push('ENDIF');
  lines.push('RETURN FALSE');

  return toNodeScript(lines.join('\n'));
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
