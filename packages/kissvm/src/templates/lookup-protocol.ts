export interface LeaseMessageConfig {
  leaseId: string
  treeId: string
  authorityPk: string
  maxTtlBlocks: bigint
  branchId?: string
  deviceId?: string
  commissionPort?: number
  leaseStatePort?: number
}

export function buildLeaseMessageScript(config: LeaseMessageConfig): string {
  const lines: string[] = [
    `LET authority = 0x${config.authorityPk}`,
    `ASSERT SIGNEDBY(authority)`,
    ``,
    `ASSERT STATE(0) EQ 0x${config.treeId}`,
    `ASSERT STATE(1) EQ 0x${config.leaseId}`,
  ]

  if (config.branchId) {
    lines.push(`ASSERT STATE(2) EQ 0x${config.branchId}`)
  }

  if (config.deviceId) {
    lines.push(`ASSERT STATE(3) EQ 0x${config.deviceId}`)
  }

  if (config.commissionPort !== undefined) {
    lines.push(
      ``,
      `LET created = PREVSTATE(${config.commissionPort})`,
      `ASSERT @BLOCK SUB created LTE ${config.maxTtlBlocks.toString()}`,
    )
  }

  if (config.leaseStatePort !== undefined) {
    lines.push(
      ``,
      `LET prevState = PREVSTATE(${config.leaseStatePort})`,
      `LET curState = STATE(${config.leaseStatePort})`,
      `ASSERT prevState EQ 0 AND curState EQ 1`,
      `OR prevState EQ 0 AND curState EQ 2`,
      `OR prevState EQ 1 AND curState EQ 3`,
    )
  }

  lines.push(``, `RETURN TRUE`)
  return lines.join('\n')
}

export interface CoinUpdateConfig {
  coinId: string
  tokenId: string
  authorityPk: string
  statePort: number
  blockWindowPort: number
  minConfirmations: bigint
}

export function buildCoinUpdateScript(config: CoinUpdateConfig): string {
  return [
    `LET authority = 0x${config.authorityPk}`,
    `ASSERT SIGNEDBY(authority)`,
    ``,
    `ASSERT STATE(0) EQ 0x${config.coinId}`,
    `ASSERT @TOKENID EQ 0x${config.tokenId}`,
    ``,
    `LET prevEvent = PREVSTATE(${config.statePort})`,
    `LET curEvent = STATE(${config.statePort})`,
    `ASSERT prevEvent EQ 0 AND curEvent EQ 1`,
    `OR prevEvent EQ 1 AND curEvent EQ 2`,
    ``,
    `LET prevBlock = PREVSTATE(${config.blockWindowPort})`,
    `ASSERT @BLOCK SUB prevBlock GTE ${config.minConfirmations.toString()}`,
    ``,
    `ASSERT VERIFYOUT(@INPUT @ADDRESS @AMOUNT @TOKENID TRUE)`,
    `RETURN TRUE`,
  ].join('\n')
}

export interface TrustMessageConfig {
  trustId: string
  subjectId: string
  subjectType: string
  authorityPk: string
  maxRating: number
  expiryWindow: bigint
  minReviewerStake?: bigint
}

export function buildTrustMessageScript(config: TrustMessageConfig): string {
  const lines: string[] = [
    `LET authority = 0x${config.authorityPk}`,
    `ASSERT SIGNEDBY(authority)`,
    ``,
    `ASSERT STATE(0) EQ 0x${config.subjectId}`,
    `ASSERT STATE(1) EQ 0x${config.subjectType}`,
    ``,
    `LET rating = STATE(2)`,
    `ASSERT rating GTE 0`,
    `ASSERT rating LTE ${config.maxRating}`,
  ]

  if (config.minReviewerStake !== undefined) {
    lines.push(
      ``,
      `ASSERT @AMOUNT GTE ${config.minReviewerStake.toString()}`,
    )
  }

  lines.push(
    ``,
    `LET created = PREVSTATE(3)`,
    `ASSERT @BLOCK SUB created LTE ${config.expiryWindow.toString()}`,
    ``,
    `RETURN TRUE`,
  )

  return lines.join('\n')
}
