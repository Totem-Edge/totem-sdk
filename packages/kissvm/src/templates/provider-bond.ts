export const BOND_STATUS = {
  DECLARED: 0,
  PENDING: 1,
  ACTIVE: 2,
  EXPIRING: 3,
  EXPIRED: 4,
  DISPUTED: 5,
  INVALID: 6,
} as const

export interface ProviderBondConfig {
  providerPk: string
  amount: string
  tokenId: string
  expiresAtBlock: bigint
  cliffBlock: bigint
  bondPort: number
  expiryPort: number
  heartbeatPort: number
  slaPort: number
  governancePk: string
  maxHeartbeatBlocks: bigint
  unbondingDurationBlocks: bigint
  releaseRequestPort: number
  claimedPort: number
  challengeDeadlineBlock: bigint
  /** Port holding the current bond status (default 5). */
  statusPort?: number
  /** Port holding the probe signer public key (default 6). */
  probeSignerPort?: number
  /** Public key of the probe signer. */
  probeSignerPk?: string
}

export function buildBondLockupScript(config: ProviderBondConfig): string {
  const statusPort = config.statusPort ?? 5

  return [
    `LET provider = 0x${config.providerPk}`,
    `LET governance = 0x${config.governancePk}`,
    ``,
    `ASSERT @AMOUNT EQ ${config.amount}`,
    ``,
    `LET expiresAt = ${config.expiresAtBlock.toString()}`,
    `ASSERT @BLOCK LT expiresAt`,
    ``,
    `LET cliff = ${config.cliffBlock.toString()}`,
    `ASSERT @BLOCK GTE cliff`,
    ``,
    `ASSERT STATE(${config.bondPort}) EQ ${config.amount}`,
    `ASSERT STATE(${config.expiryPort}) EQ expiresAt`,
    ``,
    `// Status must be declared or active`,
    `LET status = STATE(${statusPort})`,
    `ASSERT status EQ ${BOND_STATUS.DECLARED} OR status EQ ${BOND_STATUS.ACTIVE}`,
    ``,
    `ASSERT SIGNEDBY(provider)`,
    `RETURN TRUE`,
  ].join('\n')
}

export function buildHeartbeatScript(config: ProviderBondConfig): string {
  const probeSignerPk = config.probeSignerPk ?? ''
  const probeSignerPort = config.probeSignerPort ?? 6

  const lines: string[] = [
    `LET prevHeartbeat = PREVSTATE(${config.heartbeatPort})`,
    `ASSERT prevHeartbeat GT 0`,
    ``,
    `LET elapsed = @BLOCK SUB prevHeartbeat`,
    `LET maxGap = ${config.maxHeartbeatBlocks.toString()}`,
    `ASSERT elapsed LT maxGap`,
    ``,
    `LET newHeartbeat = @BLOCK`,
    `ASSERT STATE(${config.heartbeatPort}) EQ newHeartbeat`,
  ]

  if (probeSignerPk) {
    lines.push(
      ``,
      `// Probe signer must authorize`,
      `LET probeSigner = STATE(${probeSignerPort})`,
      `ASSERT probeSigner NEQ 0x00`,
      `ASSERT SIGNEDBY(probeSigner)`,
    )
  }

  lines.push(
    ``,
    `RETURN TRUE`,
  )

  return lines.join('\n')
}

/**
 * Build a bond state machine script enforcing the 7-status lifecycle:
 *   declared → pending → active → expiring → expired
 *                             ↘ disputed → invalid
 *
 * Port layout:
 *   0 — bond status
 *   1 — bond amount
 *   2 — expiresAt block
 *   3 — heartbeat block
 *   4 — SLA port
 *   5 — probe signer pk
 *   6 — current block
 */
export function buildBondStateMachineScript(config: ProviderBondConfig): string {
  return [
    `SWITCH PREVSTATE(0)`,
    ``,
    `  CASE ${BOND_STATUS.DECLARED}`,
    `    IF STATE(0) EQ ${BOND_STATUS.PENDING} THEN`,
    `      ASSERT SIGNEDBY(0x${config.governancePk})`,
    `    ELSE`,
    `      RETURN FALSE`,
    `    ENDIF`,
    ``,
    `  CASE ${BOND_STATUS.PENDING}`,
    `    IF STATE(0) EQ ${BOND_STATUS.ACTIVE} THEN`,
    `      ASSERT SIGNEDBY(0x${config.governancePk})`,
    `    ELSEIF STATE(0) EQ ${BOND_STATUS.INVALID} THEN`,
    `      ASSERT SIGNEDBY(0x${config.governancePk})`,
    `    ELSE`,
    `      RETURN FALSE`,
    `    ENDIF`,
    ``,
    `  CASE ${BOND_STATUS.ACTIVE}`,
    `    IF STATE(0) EQ ${BOND_STATUS.EXPIRING} THEN`,
    `      ASSERT @BLOCK GTE STATE(2) SUB 100`,
    `    ELSEIF STATE(0) EQ ${BOND_STATUS.DISPUTED} THEN`,
    `      ASSERT SIGNEDBY(0x${config.governancePk})`,
    `    ELSE`,
    `      RETURN FALSE`,
    `    ENDIF`,
    ``,
    `  CASE ${BOND_STATUS.EXPIRING}`,
    `    IF STATE(0) EQ ${BOND_STATUS.EXPIRED} THEN`,
    `      ASSERT @BLOCK GTE STATE(2)`,
    `    ELSE`,
    `      RETURN FALSE`,
    `    ENDIF`,
    ``,
    `  CASE ${BOND_STATUS.DISPUTED}`,
    `    IF STATE(0) EQ ${BOND_STATUS.INVALID} THEN`,
    `      ASSERT SIGNEDBY(0x${config.governancePk})`,
    `    ELSEIF STATE(0) EQ ${BOND_STATUS.ACTIVE} THEN`,
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

/**
 * Build a challenge/slash script that enforces:
 *   1. Only a challenger can file during the challenge window
 *   2. Challenger must post a dispute bond
 *   3. Governor adjudicates (uphold → slash bond, dismiss → return bond)
 *   4. Slashed funds are distributed (challenger reward + treasury)
 *
 * Port layout:
 *   0 — challenge status (0=none, 1=filed, 2=upheld, 3=dismissed)
 *   1 — challenger pk hex
 *   2 — dispute bond amount
 *   3 — adjudication deadline block
 *   4 — challenger reward share (basis points)
 */
export function buildChallengeScript(config: {
  governancePk: string
  disputeBondAmount: string
  adjudicationBlocks: bigint
  challengerRewardBps: number
  treasuryPk: string
}): string {
  return [
    `LET governance = 0x${config.governancePk}`,
    ``,
    `SWITCH PREVSTATE(0)`,
    ``,
    `  CASE 0`,
    `    // Filing a challenge`,
    `    ASSERT STATE(0) EQ 1`,
    `    LET challenger = STATE(1)`,
    `    ASSERT challenger NEQ 0x00`,
    `    ASSERT SIGNEDBY(challenger)`,
    `    // Post dispute bond`,
    `    ASSERT @AMOUNT GTE ${config.disputeBondAmount}`,
    `    // Set adjudication deadline`,
    `    LET deadline = @BLOCK ADD ${config.adjudicationBlocks.toString()}`,
    `    ASSERT STATE(3) EQ deadline`,
    ``,
    `  CASE 1`,
    `    // Adjudicating an active challenge`,
    `    IF STATE(0) EQ 2 THEN`,
    `      // Uphold: slash bond, reward challenger`,
    `      ASSERT @BLOCK LTE STATE(3)`,
    `      ASSERT SIGNEDBY(governance)`,
    `      ASSERT VERIFYOUT(0, STATE(1), ${config.disputeBondAmount}, 0x00, TRUE)`,
    `    ELSEIF STATE(0) EQ 3 THEN`,
    `      // Dismiss: return dispute bond to challenger`,
    `      ASSERT @BLOCK LTE STATE(3)`,
    `      ASSERT SIGNEDBY(governance)`,
    `      ASSERT VERIFYOUT(0, STATE(1), ${config.disputeBondAmount}, 0x00, FALSE)`,
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

export function buildBondReleaseScript(config: ProviderBondConfig): string {
  const statusPort = config.statusPort ?? 5

  return [
    `LET governance = 0x${config.governancePk}`,
    ``,
    `LET releaseRequestBlock = PREVSTATE(${config.releaseRequestPort})`,
    `ASSERT releaseRequestBlock GT 0`,
    ``,
    `LET elapsed = @BLOCK SUB releaseRequestBlock`,
    `LET unbondingDuration = ${config.unbondingDurationBlocks.toString()}`,
    ``,
    `// Status must be expiring or expired to release`,
    `LET status = STATE(${statusPort})`,
    `ASSERT status EQ ${BOND_STATUS.EXPIRING} OR status EQ ${BOND_STATUS.EXPIRED}`,
    ``,
    `IF elapsed LT unbondingDuration THEN`,
    `  ASSERT MULTISIG(1 governance)`,
    `  LET challengeDeadline = ${config.challengeDeadlineBlock.toString()}`,
    `  ASSERT @BLOCK LT challengeDeadline`,
    `ENDIF`,
    ``,
    `LET bondAmount = PREVSTATE(${config.bondPort})`,
    `LET vested = bondAmount MUL elapsed DIV unbondingDuration`,
    `LET prevClaimed = PREVSTATE(${config.claimedPort})`,
    `LET claimable = vested SUB prevClaimed`,
    ``,
    `ASSERT claimable GT 0`,
    `ASSERT @AMOUNT LTE claimable`,
    `ASSERT VERIFYOUT(@INPUT @ADDRESS @AMOUNT @TOKENID TRUE)`,
    `RETURN TRUE`,
  ].join('\n')
}
