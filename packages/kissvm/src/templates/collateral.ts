/**
 * OMP-21 — enforceable collateral bond (RFC-048 §2, RFC-050 §4/§6).
 *
 * A collateral bond turns a *promise* of slashing into an *enforced* covenant.
 * The RFC-048 invariant is explicit: liquidation MUST be triggered by an
 * **objective, on-chain-verifiable condition** and executed by covenant — never
 * by an operator's say-so (RFC-050 §6). The same template gives the borrower an
 * operator-independent reclaim path so the bond is never custodial.
 *
 * Branches:
 *   1. **Repayment release** — when `releaseCondition` holds (default: the lender
 *      signs), the collateral returns to the borrower.
 *   2. **Post-maturity settlement** — after the committed maturity block the
 *      outcome is fully determined by `liquidationCondition`: defaulted → the
 *      lender seizes; not defaulted → the borrower reclaims. Because the branch is
 *      decided by the objective condition, a defaulting borrower cannot race the
 *      lender by reclaiming first.
 *   3. **Pre-maturity default** — before maturity, an objective default lets the
 *      lender seize (permissionless; payout fixed to the lender).
 *
 * The lender can never pay itself except through the objective condition, and the
 * borrower always has a timelocked reclaim when no default is proven.
 */

export interface CollateralBondConfig {
  /** Borrower identity / reclaim destination (WOTS public-key digest, hex). */
  borrower: string;
  /** Lender identity / seizure destination (hex). */
  lender: string;
  /** Asset id (hex). Defaults to `0x00` (MINIMA). */
  tokenId?: string;
  /** State port carrying the absolute maturity block. Default 100. */
  maturityPort?: number;
  /**
   * Objective, on-chain-verifiable default condition (KISSVM boolean expression),
   * e.g. `MAST(0x<oracleRoot>)`, `@BLOCK GTE 500000`. Required — liquidation
   * without an objective condition is discretionary and MUST NOT be used.
   */
  liquidationCondition: string;
  /**
   * Condition under which the collateral is released to the borrower after
   * repayment. Defaults to `SIGNEDBY(<lender>)`.
   */
  releaseCondition?: string;
}

export interface CollateralBondState {
  port: number;
  value: bigint;
  type: 'number';
}

function requireHex(value: string, field: string): string {
  const raw = value.replace(/^0x/i, '');
  if (raw.length === 0 || !/^[0-9a-fA-F]+$/.test(raw)) {
    throw new Error(`CollateralBondConfig.${field} must be a hex string; received ${JSON.stringify(value)}`);
  }
  return raw;
}

function requirePort(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 0 || value > 255) {
    throw new Error(`CollateralBondConfig.${field} must be a byte port (0–255); received ${JSON.stringify(value)}`);
  }
  return value;
}

/** Committed maturity state variable for a collateral bond. */
export function collateralBondStateVariables(config: {
  maturityBlock: bigint;
  maturityPort?: number;
}): CollateralBondState[] {
  const maturityPort = requirePort(config.maturityPort ?? 100, 'maturityPort');
  return [{ port: maturityPort, value: config.maturityBlock, type: 'number' }];
}

/** Build the OMP-21 collateral-bond covenant script. */
export function buildCollateralBondScript(config: CollateralBondConfig): string {
  const borrower = requireHex(config.borrower, 'borrower');
  const lender = requireHex(config.lender, 'lender');
  const tokenId = config.tokenId ? '0x' + requireHex(config.tokenId, 'tokenId') : '0x00';
  const maturityPort = requirePort(config.maturityPort ?? 100, 'maturityPort');
  if (!config.liquidationCondition || config.liquidationCondition.trim().length === 0) {
    throw new Error('CollateralBondConfig.liquidationCondition is required (objective, on-chain-verifiable)');
  }

  const borrowerHex = `0x${borrower}`;
  const lenderHex = `0x${lender}`;
  const liquidationCondition = config.liquidationCondition.trim();
  const releaseCondition = (config.releaseCondition ?? `SIGNEDBY(${lenderHex})`).trim();

  const lines: string[] = [
    `// OMP-21 — enforceable collateral bond (RFC-048 §2, RFC-050 §6)`,
    `// Liquidation is objective (never discretionary); the borrower keeps a reclaim path.`,
    `LET maturity = PREVSTATE(${maturityPort})`,
    `ASSERT SAMESTATE(${maturityPort} ${maturityPort})`,
    ``,
    `// 1. Repayment release → collateral returns to the borrower.`,
    `IF ${releaseCondition} THEN`,
    `  ASSERT VERIFYOUT(0 ${borrowerHex} @AMOUNT ${tokenId} FALSE)`,
    `  RETURN TRUE`,
    `ENDIF`,
    ``,
    `// 2. Post-maturity settlement — decided by the objective condition (no race).`,
    `IF @BLOCK GTE maturity THEN`,
    `  IF ${liquidationCondition} THEN`,
    `    ASSERT VERIFYOUT(0 ${lenderHex} @AMOUNT ${tokenId} FALSE)`,
    `  ELSE`,
    `    ASSERT VERIFYOUT(0 ${borrowerHex} @AMOUNT ${tokenId} FALSE)`,
    `  ENDIF`,
    `  RETURN TRUE`,
    `ENDIF`,
    ``,
    `// 3. Pre-maturity default → the lender seizes (permissionless, fixed payout).`,
    `IF ${liquidationCondition} THEN`,
    `  ASSERT VERIFYOUT(0 ${lenderHex} @AMOUNT ${tokenId} FALSE)`,
    `  RETURN TRUE`,
    `ENDIF`,
    ``,
    `RETURN FALSE`,
  ];

  return lines.join('\n');
}
