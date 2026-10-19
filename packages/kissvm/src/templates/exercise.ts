/**
 * P-EXIT — enforceable unilateral exercise / settlement covenant (RFC-050 §3).
 *
 * The load-bearing primitive for every non-trivial Eefi product (lease return,
 * credit default, option exercise, parametric payout, tranche waterfall): a party
 * must be able to **exercise or settle without the counterparty's cooperation**.
 *
 * Omnia's settlement branch is both-signed and cannot provide that on its own.
 * This template produces a standalone KISSVM covenant under which:
 *
 *   - the **beneficiary** can spend, after an **objective on-chain condition**
 *     (a committed maturity block, or a caller-supplied condition expression such
 *     as a `MAST(...)` oracle witness), to **exactly** the committed beneficiary
 *     path — requiring only the beneficiary's own signature, never the owner's
 *     signature or liveness; and
 *   - the **owner** can reclaim the balance only through a separate recovery
 *     branch that opens **after** the exercise window (or, for liquidation, after
 *     the same objective condition), paying the owner's own committed address.
 *
 * The owner therefore has **no branch that can redirect value to itself before
 * the condition**, and none that pays the beneficiary's share to anyone else.
 *
 * This is the Eefi analogue of the RFC-039 per-share exit: the exit must be
 * executable, not promised. Without a covenant of this shape a product is
 * trust-minimised at best and MUST be labelled as such (CUSTODY-POLICY).
 *
 * Two payout shapes are supported:
 *   - **whole-balance** (default): the beneficiary receives `@AMOUNT` (the fully
 *     collateralized case); and
 *   - **fixed payout + remainder**: the beneficiary receives an exact `payout`,
 *     and any excess returns to `remainderTo` (default: the owner/recovery).
 */

/** Condition under which the exercise branch opens. */
export type ExerciseKind = 'unilateral-exercise' | 'liquidation' | 'maturity-redemption';

export interface ExerciseCovenantConfig {
  /** What opens the exercise branch (documentation + default condition shape). */
  kind: ExerciseKind;
  /**
   * Beneficiary identity and exact payout destination (WOTS public-key digest,
   * hex). Used both as the `SIGNEDBY` identity and the `VERIFYOUT` address, so
   * the exercised value can only reach this party.
   */
  beneficiary: string;
  /**
   * Owner / recovery identity and destination (hex). Reclaims the whole balance
   * through the recovery branch only after the exercise window closes.
   */
  recovery: string;
  /** Asset id (hex). Defaults to `0x00` (MINIMA). */
  tokenId?: string;
  /** State port carrying the absolute maturity block. Default 100. */
  maturityPort?: number;
  /** State port carrying the absolute recovery block. Default 101. */
  recoveryPort?: number;
  /**
   * Objective condition that opens the exercise branch, as a KISSVM boolean
   * expression (e.g. `MAST(0x<conditionRoot>)`, `SIGNEDBY(0x<oracle>)`,
   * `@BLOCK GTE 500000`). When omitted, the default is the committed time window
   * `maturity ≤ @BLOCK < recovery`.
   */
  condition?: string;
  /**
   * Require the beneficiary's signature to exercise (default `true`). The owner
   * never signs either way. Set `false` for a permissionless trigger whose payout
   * is still fixed to the beneficiary.
   */
  requireSignature?: boolean;
  /**
   * Exact amount (atoms) the beneficiary receives on exercise. When omitted the
   * beneficiary receives the whole balance (`@AMOUNT`). When set, any excess
   * above `payout` returns to {@link remainderTo}.
   */
  payout?: bigint;
  /**
   * Destination for the remainder when `payout < @AMOUNT` (hex). Defaults to the
   * recovery/owner address.
   */
  remainderTo?: string;
}

export interface ExerciseCovenantState {
  port: number;
  value: bigint;
  type: 'number';
}

function requireHex(value: string, field: string): string {
  const raw = value.replace(/^0x/i, '');
  if (raw.length === 0 || !/^[0-9a-fA-F]+$/.test(raw)) {
    throw new Error(`ExerciseCovenantConfig.${field} must be a hex string; received ${JSON.stringify(value)}`);
  }
  return raw;
}

function requirePort(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 0 || value > 255) {
    throw new Error(`ExerciseCovenantConfig.${field} must be a byte port (0–255); received ${JSON.stringify(value)}`);
  }
  return value;
}

/**
 * Committed state variables for a time-bounded exercise covenant: the absolute
 * maturity and recovery blocks, seeded into the covenant's funding output. Read
 * back by the script via `PREVSTATE` and pinned with `SAMESTATE` so no spend can
 * move the exercise clock.
 */
export function exerciseCovenantStateVariables(config: {
  maturityBlock: bigint;
  recoveryBlock: bigint;
  maturityPort?: number;
  recoveryPort?: number;
}): ExerciseCovenantState[] {
  const maturityPort = requirePort(config.maturityPort ?? 100, 'maturityPort');
  const recoveryPort = requirePort(config.recoveryPort ?? 101, 'recoveryPort');
  if (config.recoveryBlock <= config.maturityBlock) {
    throw new Error('exerciseCovenantStateVariables: recoveryBlock must be strictly greater than maturityBlock');
  }
  return [
    { port: maturityPort, value: config.maturityBlock, type: 'number' },
    { port: recoveryPort, value: config.recoveryBlock, type: 'number' },
  ];
}

/**
 * Build the P-EXIT exercise/settlement covenant script.
 *
 * Layout:
 * ```
 *   exercise: IF <condition> THEN [IF SIGNEDBY(beneficiary) THEN]
 *               ASSERT VERIFYOUT(0 beneficiary payout|@AMOUNT tokenId FALSE)
 *               IF payout < @AMOUNT THEN RETURN VERIFYOUT(1 remainder @AMOUNT-payout tokenId TRUE) ENDIF
 *               RETURN TRUE
 *             [ENDIF] ENDIF
 *   recovery: IF @BLOCK GTE RECOVERY THEN
 *               ASSERT VERIFYOUT(0 recovery @AMOUNT tokenId FALSE); RETURN TRUE
 *             ENDIF
 *   RETURN FALSE
 * ```
 */
export function buildExerciseCovenant(config: ExerciseCovenantConfig): string {
  const beneficiary = requireHex(config.beneficiary, 'beneficiary');
  const recovery = requireHex(config.recovery, 'recovery');
  const remainderTo = config.remainderTo ? '0x' + requireHex(config.remainderTo, 'remainderTo') : `0x${recovery}`;
  const tokenId = config.tokenId ? '0x' + requireHex(config.tokenId, 'tokenId') : '0x00';
  const maturityPort = requirePort(config.maturityPort ?? 100, 'maturityPort');
  const recoveryPort = requirePort(config.recoveryPort ?? 101, 'recoveryPort');
  const requireSignature = config.requireSignature ?? true;
  if (config.payout !== undefined && config.payout <= 0n) {
    throw new Error(`ExerciseCovenantConfig.payout must be a positive amount; received ${config.payout}`);
  }

  const beneficiaryHex = `0x${beneficiary}`;
  const recoveryHex = `0x${recovery}`;

  const useCondition = config.condition !== undefined && config.condition.trim().length > 0;

  // ---- exercise branch (built unindented, then indented by nesting depth) ----
  const body: string[] = [];
  if (config.payout !== undefined) {
    const payout = config.payout.toString();
    body.push(`ASSERT @AMOUNT GTE ${payout}`);
    body.push(`ASSERT VERIFYOUT(0 ${beneficiaryHex} ${payout} ${tokenId} FALSE)`);
    body.push(`IF @AMOUNT GT ${payout} THEN`);
    body.push(`  RETURN VERIFYOUT(1 ${remainderTo} @AMOUNT SUB ${payout} ${tokenId} TRUE)`);
    body.push(`ENDIF`);
    body.push(`RETURN TRUE`);
  } else {
    body.push(`ASSERT VERIFYOUT(0 ${beneficiaryHex} @AMOUNT ${tokenId} FALSE)`);
    body.push(`RETURN TRUE`);
  }

  const pad = (lines: string[], depth: number): string[] =>
    lines.map((l) => `${'  '.repeat(depth)}${l}`);

  // Nesting: condition (depth 1) → optional signature (depth 2) → body.
  let exercise = body;
  if (requireSignature) {
    exercise = [
      `IF SIGNEDBY(${beneficiaryHex}) THEN`,
      ...pad(exercise, 1),
      `ENDIF`,
    ];
  }
  if (useCondition) {
    exercise = [`IF ${config.condition!.trim()} THEN`, ...pad(exercise, 1), `ENDIF`];
  } else {
    exercise = [
      `IF @BLOCK GTE MATURITY THEN`,
      `  IF @BLOCK LT RECOVERY THEN`,
      ...pad(exercise, 2),
      `  ENDIF`,
      `ENDIF`,
    ];
  }

  const lines: string[] = [
    `// P-EXIT — enforceable unilateral exercise covenant (RFC-050 §3)`,
    `// kind: ${config.kind}`,
    `// The owner cannot redirect the beneficiary path; exercise needs only the beneficiary.`,
    `LET MATURITY = PREVSTATE(${maturityPort})`,
    `LET RECOVERY = PREVSTATE(${recoveryPort})`,
    `ASSERT SAMESTATE(${maturityPort} ${maturityPort})`,
    `ASSERT SAMESTATE(${recoveryPort} ${recoveryPort})`,
    ``,
    `// ---- exercise branch ----`,
    ...exercise,
    ``,
    `// ---- recovery branch (owner reclaim, only after the window) ----`,
    `IF @BLOCK GTE RECOVERY THEN`,
    `  ASSERT VERIFYOUT(0 ${recoveryHex} @AMOUNT ${tokenId} FALSE)`,
    `  RETURN TRUE`,
    `ENDIF`,
    ``,
    `RETURN FALSE`,
  ];

  return lines.join('\n');
}
