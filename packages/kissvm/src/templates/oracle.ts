import { wotsAddressData } from '@totemsdk/core';
import { toNodeScript } from '@totemsdk/core';
/**
 * OMP-18 / OMP-19 — on-chain oracle condition witness (RFC-048 §3.1).
 *
 * Turns a signed oracle **observation** into an objective on-chain condition for a
 * spend (price-linked / parametric payouts, liquidation triggers, condition
 * witnesses). It reuses the existing evidence stack (`proof` / `proofgraph` /
 * `identity`); it does **not** define a second signature scheme.
 *
 * On-chain semantics (and their honest limit):
 *   - The observation fields are **committed** to state ports at funding (see
 *     {@link oracleConditionStateVariables}); the witness reads them via
 *     `PREVSTATE` and pins the feed commitment with `SAMESTATE`.
 *   - The authorized oracle(s) authorize the spend — `MULTISIG(threshold …)` — so
 *     a quorum can be required. In this SDK, `CHECKSIG`/`SIGNEDBY` verify against
 *     the **transaction digest**, and the transaction commits the observation, so
 *     the oracle's signature is a cooperative attestation **bound to the spend**.
 *   - Freshness (`observedAt ≤ @BLOCK ≤ validUntil`) and the objective value
 *     comparison (`value OP threshold`) are enforced in-script; the witness
 *     **fails closed** on a stale observation, an untrusted signer, or a
 *     non-matching value.
 *
 * **Unilateral (non-cooperative) use.** If a product needs to exercise an oracle
 * condition *without* the oracle being online, do not rely on the oracle signing
 * the spend. Instead commit the observation at funding and use the P-EXIT exercise
 * covenant (`buildExerciseCovenant`) — optionally with a pre-signed exercise
 * transaction — so the beneficiary triggers settlement alone (RFC-048 §3.1
 * caveat; RFC-050 §3). This template is the **cooperative/attested** shape and
 * MUST be disclosed as such when used directly.
 */

export type OracleComparisonOp = 'GT' | 'GTE' | 'LT' | 'LTE' | 'EQ' | 'NEQ';

export interface OracleConditionConfig {
  /** Authorized oracle public-key digests (hex). One = single-trusted, N = quorum. */
  oracles: string[];
  /** Quorum threshold. Defaults to all oracles. */
  threshold?: number;
  /** Objective comparison applied to the committed value. */
  comparison: { op: OracleComparisonOp; valueAtoms: bigint };
  /** When set, the witness pays the whole balance to this beneficiary. */
  beneficiary?: string;
  /** Asset id (hex). Defaults to `0x00` (MINIMA). */
  tokenId?: string;
  /** State port carrying the observation value. Default 120. */
  valuePort?: number;
  /** State port carrying the observation's earliest-valid block. Default 121. */
  observedAtPort?: number;
  /** State port carrying the observation's expiry block. Default 122. */
  validUntilPort?: number;
  /** State port carrying the feed/schema commitment. Default 123. */
  feedPort?: number;
  /** State port carrying the anti-replay sequence. Default 124. */
  sequencePort?: number;
  /** Require the committed sequence to strictly advance. Default false. */
  requireSequenceAdvance?: boolean;
}

export interface OracleCommitment {
  /** Canonical signed integer value (atoms). */
  valueAtoms: bigint;
  /** Earliest block the observation is valid (block-based freshness). */
  observedAtBlock: bigint;
  /** Block after which the observation is stale. */
  validUntilBlock: bigint;
  /** Feed/schema commitment (hex) — e.g. sha3 of `feedId|unit|scale`. */
  feedHash: string;
}

export interface OracleStateVariable {
  port: number;
  value: bigint | string;
  type: 'number' | 'hex';
}

const DEFAULT_PORTS = { valuePort: 120, observedAtPort: 121, validUntilPort: 122, feedPort: 123, sequencePort: 124 };

function requireHex(value: string, field: string): string {
  const raw = value.replace(/^0x/i, '');
  if (raw.length === 0 || !/^[0-9a-fA-F]+$/.test(raw)) {
    throw new Error(`OracleConditionConfig.${field} must be a hex string; received ${JSON.stringify(value)}`);
  }
  return raw;
}

function requirePort(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 0 || value > 255) {
    throw new Error(`OracleConditionConfig.${field} must be a byte port (0–255); received ${JSON.stringify(value)}`);
  }
  return value;
}

/**
 * Commit an oracle observation to state at funding. The witness reads these back
 * via `PREVSTATE`; the feed commitment is pinned with `SAMESTATE` so it cannot be
 * swapped by a spender.
 */
export function oracleConditionStateVariables(
  commitment: OracleCommitment,
  ports: { valuePort?: number; observedAtPort?: number; validUntilPort?: number; feedPort?: number } = {},
): OracleStateVariable[] {
  const valuePort = requirePort(ports.valuePort ?? DEFAULT_PORTS.valuePort, 'valuePort');
  const observedAtPort = requirePort(ports.observedAtPort ?? DEFAULT_PORTS.observedAtPort, 'observedAtPort');
  const validUntilPort = requirePort(ports.validUntilPort ?? DEFAULT_PORTS.validUntilPort, 'validUntilPort');
  const feedPort = requirePort(ports.feedPort ?? DEFAULT_PORTS.feedPort, 'feedPort');
  if (commitment.validUntilBlock <= commitment.observedAtBlock) {
    throw new Error('oracleConditionStateVariables: validUntilBlock must be strictly greater than observedAtBlock');
  }
  return [
    { port: valuePort, value: commitment.valueAtoms, type: 'number' },
    { port: observedAtPort, value: commitment.observedAtBlock, type: 'number' },
    { port: validUntilPort, value: commitment.validUntilBlock, type: 'number' },
    { port: feedPort, value: '0x' + requireHex(commitment.feedHash, 'feedHash'), type: 'hex' },
  ];
}

/** Build the on-chain oracle condition witness (optionally with a payout). */
export function buildOracleConditionScript(config: OracleConditionConfig): string {
  if (!Array.isArray(config.oracles) || config.oracles.length === 0) {
    throw new Error('OracleConditionConfig.oracles must contain at least one authorized oracle');
  }
  const oracles = config.oracles.map((o, i) => `0x${requireHex(o, `oracles[${i}]`)}`);
  const threshold = config.threshold ?? oracles.length;
  if (!Number.isInteger(threshold) || threshold < 1 || threshold > oracles.length) {
    throw new Error(`OracleConditionConfig.threshold must be between 1 and ${oracles.length}`);
  }
  const op = config.comparison.op;
  if (!['GT', 'GTE', 'LT', 'LTE', 'EQ', 'NEQ'].includes(op)) {
    throw new Error(`OracleConditionConfig.comparison.op must be a comparison operator; received ${JSON.stringify(op)}`);
  }
  const valueAtoms = config.comparison.valueAtoms.toString();

  const valuePort = requirePort(config.valuePort ?? DEFAULT_PORTS.valuePort, 'valuePort');
  const observedAtPort = requirePort(config.observedAtPort ?? DEFAULT_PORTS.observedAtPort, 'observedAtPort');
  const validUntilPort = requirePort(config.validUntilPort ?? DEFAULT_PORTS.validUntilPort, 'validUntilPort');
  const feedPort = requirePort(config.feedPort ?? DEFAULT_PORTS.feedPort, 'feedPort');
  const sequencePort = requirePort(config.sequencePort ?? DEFAULT_PORTS.sequencePort, 'sequencePort');
  const tokenId = config.tokenId ? '0x' + requireHex(config.tokenId, 'tokenId') : '0x00';

  const lines: string[] = [
    `// OMP-19 — on-chain oracle condition witness (RFC-048 §3.1)`,
    `// Cooperative/attested shape: the oracle authorizes the tx digest, which commits`,
    `// the observation. For a non-cooperative exercise, commit at funding + use P-EXIT.`,
    `LET observed = PREVSTATE(${observedAtPort})`,
    `LET valid = PREVSTATE(${validUntilPort})`,
    `LET value = PREVSTATE(${valuePort})`,
    ``,
    `// 1. authorized oracle(s) / quorum`,
    `ASSERT MULTISIG(${threshold} ${oracles.join(' ')})`,
    ``,
    `// 2. feed/schema commitment is immutable`,
    `ASSERT SAMESTATE(${feedPort} ${feedPort})`,
    ``,
    `// 3. freshness window (fail closed when stale)`,
    `ASSERT @BLOCK GTE observed`,
    `ASSERT @BLOCK LTE valid`,
    ``,
  ];

  if (config.requireSequenceAdvance) {
    lines.push(
      `// 4. anti-replay: sequence strictly advances`,
      `ASSERT STATE(${sequencePort}) EQ PREVSTATE(${sequencePort}) + 1`,
      ``,
    );
  }

  lines.push(
    `// 5. objective value condition`,
    `ASSERT value ${op} ${valueAtoms}`,
    ``,
  );

  if (config.beneficiary !== undefined) {
    const beneficiary = `0x${requireHex(config.beneficiary, 'beneficiary')}`;
    const beneficiaryAddr = wotsAddressData(beneficiary);
    lines.push(
      `// 6. payout`,
      `ASSERT VERIFYOUT(0 ${beneficiaryAddr} @AMOUNT ${tokenId} FALSE)`,
      ``,
    );
  }

  lines.push(`RETURN TRUE`);
  return toNodeScript(lines.join('\n'));
}

// ─────────────────────────────────────────────────────────────────────────────
// Non-cooperative oracle exercise: commit the observation at funding and let the
// beneficiary exercise alone (P-EXIT × OMP-19). No oracle signature at exercise.
// ─────────────────────────────────────────────────────────────────────────────

export interface OracleExerciseCovenantConfig {
  /** Beneficiary identity / exercise destination (hex). */
  beneficiary: string;
  /** Owner / recovery destination (hex); reclaims after the recovery block. */
  recovery: string;
  /** Objective comparison applied to the committed observation value. */
  comparison: { op: OracleComparisonOp; valueAtoms: bigint };
  /** Asset id (hex). Defaults to `0x00` (MINIMA). */
  tokenId?: string;
  /** State port carrying the absolute maturity block. Default 100. */
  maturityPort?: number;
  /** State port carrying the absolute recovery block. Default 101. */
  recoveryPort?: number;
  /** State port carrying the observation value. Default 120. */
  valuePort?: number;
  /** State port carrying the observation's earliest-valid block. Default 121. */
  observedAtPort?: number;
  /** State port carrying the observation's expiry block. Default 122. */
  validUntilPort?: number;
  /** State port carrying the feed/schema commitment. Default 123. */
  feedPort?: number;
  /** Exact payout (atoms). When omitted the beneficiary receives the whole balance. */
  payout?: bigint;
  /** Remainder destination when `payout < @AMOUNT`. Defaults to the recovery address. */
  remainderTo?: string;
}

/**
 * Build the composed P-EXIT × OMP-19 covenant: the observation is committed at
 * funding, and after maturity the beneficiary can exercise **alone** — with only
 * its own signature — provided the committed observation is fresh and satisfies
 * the objective value condition. The oracle is not required at exercise time.
 */
export function buildOracleExerciseCovenant(config: OracleExerciseCovenantConfig): string {
  const beneficiary = `0x${requireHex(config.beneficiary, 'beneficiary')}`;
  const recovery = `0x${requireHex(config.recovery, 'recovery')}`;
  const remainderTo = config.remainderTo ? '0x' + requireHex(config.remainderTo, 'remainderTo') : recovery;
  const beneficiaryAddr = wotsAddressData(beneficiary);
  const recoveryAddr = wotsAddressData(recovery);
  const remainderAddr = wotsAddressData(remainderTo);
  const tokenId = config.tokenId ? '0x' + requireHex(config.tokenId, 'tokenId') : '0x00';
  const op = config.comparison.op;
  if (!['GT', 'GTE', 'LT', 'LTE', 'EQ', 'NEQ'].includes(op)) {
    throw new Error(`OracleExerciseCovenantConfig.comparison.op must be a comparison operator; received ${JSON.stringify(op)}`);
  }
  if (config.payout !== undefined && config.payout <= 0n) {
    throw new Error(`OracleExerciseCovenantConfig.payout must be a positive amount; received ${config.payout}`);
  }

  const maturityPort = requirePort(config.maturityPort ?? 100, 'maturityPort');
  const recoveryPort = requirePort(config.recoveryPort ?? 101, 'recoveryPort');
  const valuePort = requirePort(config.valuePort ?? DEFAULT_PORTS.valuePort, 'valuePort');
  const observedAtPort = requirePort(config.observedAtPort ?? DEFAULT_PORTS.observedAtPort, 'observedAtPort');
  const validUntilPort = requirePort(config.validUntilPort ?? DEFAULT_PORTS.validUntilPort, 'validUntilPort');
  const feedPort = requirePort(config.feedPort ?? DEFAULT_PORTS.feedPort, 'feedPort');

  const body: string[] = [
    `ASSERT @BLOCK GTE observed`,
    `ASSERT @BLOCK LTE valid`,
    `ASSERT value ${op} ${config.comparison.valueAtoms.toString()}`,
  ];
  if (config.payout !== undefined) {
    const payout = config.payout.toString();
    body.push(`ASSERT @AMOUNT GTE ${payout}`);
    body.push(`ASSERT VERIFYOUT(0 ${beneficiaryAddr} ${payout} ${tokenId} FALSE)`);
    body.push(`IF @AMOUNT GT ${payout} THEN`);
    body.push(`  RETURN VERIFYOUT(1 ${remainderAddr} @AMOUNT - ${payout} ${tokenId} TRUE)`);
    body.push(`ENDIF`);
    body.push(`RETURN TRUE`);
  } else {
    body.push(`ASSERT VERIFYOUT(0 ${beneficiaryAddr} @AMOUNT ${tokenId} FALSE)`);
    body.push(`RETURN TRUE`);
  }

  const pad = (lines: string[], depth: number): string[] => lines.map((l) => `${'  '.repeat(depth)}${l}`);
  const exercise = [
    `IF @BLOCK GTE maturity THEN`,
    `  IF @BLOCK LT recovery THEN`,
    `    IF SIGNEDBY(${beneficiary}) THEN`,
    ...pad(body, 3),
    `    ENDIF`,
    `  ENDIF`,
    `ENDIF`,
  ];

  const lines: string[] = [
    `// P-EXIT × OMP-19 — non-cooperative oracle exercise (RFC-050 §3, RFC-048 §3.1)`,
    `// Observation committed at funding; the beneficiary exercises alone. No oracle liveness.`,
    `LET maturity = PREVSTATE(${maturityPort})`,
    `LET recovery = PREVSTATE(${recoveryPort})`,
    `LET observed = PREVSTATE(${observedAtPort})`,
    `LET valid = PREVSTATE(${validUntilPort})`,
    `LET value = PREVSTATE(${valuePort})`,
    `ASSERT SAMESTATE(${maturityPort} ${maturityPort})`,
    `ASSERT SAMESTATE(${recoveryPort} ${recoveryPort})`,
    `ASSERT SAMESTATE(${feedPort} ${feedPort})`,
    ``,
    `// ---- exercise branch (beneficiary alone) ----`,
    ...exercise,
    ``,
    `// ---- recovery branch (owner reclaim, only after the window) ----`,
    `IF @BLOCK GTE recovery THEN`,
    `  ASSERT VERIFYOUT(0 ${recoveryAddr} @AMOUNT ${tokenId} FALSE)`,
    `  RETURN TRUE`,
    `ENDIF`,
    ``,
    `RETURN FALSE`,
  ];

  return toNodeScript(lines.join('\n'));
}
