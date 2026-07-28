export const POSITION_STATUS = {
  DRAFT: 0,
  COMMITTED: 1,
  ACTIVE: 2,
  QUIESCING: 3,
  WITHDRAWN: 4,
  DEPLETED: 5,
  DISPUTED: 6,
  INVALID: 7,
  EXPIRED: 8,
} as const

export interface LiquidityLockConfig {
  providerPk: string
  amount: string
  tokenId: string
  /** Unlock block (pre-computed as cliffBlock + unlockAfterBlock). */
  unlockBlock: bigint
  /** Port for the lock amount (default 0). */
  amountPort?: number
  /** Port for the unlock block (default 1). */
  unlockPort?: number
  /** Port for position status (default 2). */
  statusPort?: number
  /** Port for the fee recipient address (default 3). */
  governancePort?: number
}

/**
 * Build a liquidity lock script that enforces:
 *   1. Position status is committed or active (not depleted/invalid/expired)
 *   2. Current block >= unlockBlock
 *   3. Amount matches committed value
 *   4. Provider must sign
 *
 * Port layout:
 *   0 — amount
 *   1 — unlockBlock
 *   2 — status
 *   3 — fee recipient pk hex
 */
export function buildLiquidityLockScript(config: LiquidityLockConfig): string {
  const amountPort = config.amountPort ?? 0
  const unlockPort = config.unlockPort ?? 1
  const statusPort = config.statusPort ?? 2

  return [
    `LET provider = 0x${config.providerPk}`,
    ``,
    `// Status must be committed or active`,
    `LET status = STATE(${statusPort})`,
    `ASSERT status EQ ${POSITION_STATUS.COMMITTED} OR status EQ ${POSITION_STATUS.ACTIVE}`,
    ``,
    `// Unlock check`,
    `LET unlockBlock = STATE(${unlockPort})`,
    `ASSERT @BLOCK GTE unlockBlock`,
    ``,
    `// Amount check`,
    `ASSERT @AMOUNT EQ STATE(${amountPort})`,
    ``,
    `ASSERT SIGNEDBY(provider)`,
    `RETURN TRUE`,
  ].join('\n')
}

/**
 * Build a fee accrual script that enforces:
 *   1. Fee accrual is within the window: startBlock <= @BLOCK <= endBlock
 *   2. Fee = rate * elapsed / totalPeriod (pro-rata)
 *   3. Claimable = accrued - prevClaimed (no double claim)
 *   4. Fee goes to governance/fee recipient
 *
 * Port layout (same coin, higher ports for fee data):
 *   10 — fee start block
 *   11 — fee end block
 *   12 — fee accrued so far
 *   13 — rate (amount per period)
 */
export function buildFeeAccrualScript(config: LiquidityLockConfig): string {
  const governancePort = config.governancePort ?? 3

  return [
    `LET startBlock = PREVSTATE(10)`,
    `LET endBlock = STATE(11)`,
    `ASSERT @BLOCK GTE startBlock`,
    `ASSERT @BLOCK LTE endBlock`,
    ``,
    `LET totalBlocks = endBlock SUB startBlock`,
    `ASSERT totalBlocks GT 0`,
    ``,
    `LET elapsed = @BLOCK SUB startBlock`,
    `LET rate = STATE(13)`,
    `LET fee = rate MUL elapsed DIV totalBlocks`,
    ``,
    `LET prevClaimed = PREVSTATE(12)`,
    `LET claimable = fee SUB prevClaimed`,
    ``,
    `ASSERT claimable GT 0`,
    `ASSERT @AMOUNT LTE claimable`,
    `ASSERT VERIFYOUT(@INPUT STATE(${governancePort}) @AMOUNT @TOKENID TRUE)`,
    `RETURN TRUE`,
  ].join('\n')
}

/**
 * Build a withdrawal script that enforces:
 *   1. Status is quiescing or active (not locked)
 *   2. Current block >= unlockBlock
 *   3. Provider must sign
 *   4. Output must be a valid withdrawal (LP receives funds)
 *   5. Withdrawal count tracked (max 10)
 *
 * Port layout:
 *   0 — amount
 *   1 — unlockBlock
 *   2 — status
 *   3 — fee recipient pk hex
 *   4 — withdrawal count
 */
export function buildWithdrawalScript(config: LiquidityLockConfig): string {
  const amountPort = config.amountPort ?? 0
  const unlockPort = config.unlockPort ?? 1
  const statusPort = config.statusPort ?? 2

  return [
    `LET provider = 0x${config.providerPk}`,
    ``,
    `// Status check`,
    `LET status = STATE(${statusPort})`,
    `ASSERT status EQ ${POSITION_STATUS.QUIESCING} OR status EQ ${POSITION_STATUS.ACTIVE}`,
    ``,
    `// Unlock check`,
    `LET unlockBlock = STATE(${unlockPort})`,
    `ASSERT @BLOCK GTE unlockBlock`,
    ``,
    `// Fee recipient must be the same (no redirect)`,
    `ASSERT SAMESTATE(3 3)`,
    ``,
    `// Withdrawal count tracking`,
    `LET prevCount = PREVSTATE(4)`,
    `LET newCount = prevCount ADD 1`,
    `ASSERT STATE(4) EQ newCount`,
    `ASSERT newCount LTE 10`,
    ``,
    `ASSERT SIGNEDBY(provider)`,
    `ASSERT VERIFYOUT(@INPUT @ADDRESS @AMOUNT @TOKENID TRUE)`,
    `RETURN TRUE`,
  ].join('\n')
}

/**
 * Build a position state machine script enforcing the position lifecycle:
 *   draft → committed → active → quiescing → withdrawn
 *              ↘ depleted    ↘ depleted
 *              ↘ invalid      ↘ invalid
 *                             ↘ disputed
 * Port 0 holds the status.
 */
export function buildPositionStateMachineScript(config: {
  governancePk: string
}): string {
  return [
    `SWITCH PREVSTATE(0)`,
    ``,
    `  CASE ${POSITION_STATUS.DRAFT}`,
    `    IF STATE(0) EQ ${POSITION_STATUS.COMMITTED} THEN`,
    `      ASSERT SIGNEDBY(0x${config.governancePk})`,
    `    ELSE`,
    `      RETURN FALSE`,
    `    ENDIF`,
    ``,
    `  CASE ${POSITION_STATUS.COMMITTED}`,
    `    IF STATE(0) EQ ${POSITION_STATUS.ACTIVE} THEN`,
    `      RETURN TRUE`,
    `    ELSEIF STATE(0) EQ ${POSITION_STATUS.DEPLETED} THEN`,
    `      ASSERT SIGNEDBY(0x${config.governancePk})`,
    `    ELSEIF STATE(0) EQ ${POSITION_STATUS.INVALID} THEN`,
    `      ASSERT SIGNEDBY(0x${config.governancePk})`,
    `    ELSE`,
    `      RETURN FALSE`,
    `    ENDIF`,
    ``,
    `  CASE ${POSITION_STATUS.ACTIVE}`,
    `    IF STATE(0) EQ ${POSITION_STATUS.QUIESCING} THEN`,
    `      RETURN TRUE`,
    `    ELSEIF STATE(0) EQ ${POSITION_STATUS.DEPLETED} THEN`,
    `      ASSERT SIGNEDBY(0x${config.governancePk})`,
    `    ELSEIF STATE(0) EQ ${POSITION_STATUS.DISPUTED} THEN`,
    `      ASSERT SIGNEDBY(0x${config.governancePk})`,
    `    ELSEIF STATE(0) EQ ${POSITION_STATUS.INVALID} THEN`,
    `      ASSERT SIGNEDBY(0x${config.governancePk})`,
    `    ELSE`,
    `      RETURN FALSE`,
    `    ENDIF`,
    ``,
    `  CASE ${POSITION_STATUS.QUIESCING}`,
    `    IF STATE(0) EQ ${POSITION_STATUS.WITHDRAWN} THEN`,
    `      RETURN TRUE`,
    `    ELSEIF STATE(0) EQ ${POSITION_STATUS.DEPLETED} THEN`,
    `      ASSERT SIGNEDBY(0x${config.governancePk})`,
    `    ELSE`,
    `      RETURN FALSE`,
    `    ENDIF`,
    ``,
    `  DEFAULT`,
    `    RETURN FALSE`,
    ``,
    `ENDSWITCH`,
    ``,
    `RETURN TRUE`,
  ].join('\n')
}
