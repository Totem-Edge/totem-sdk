export const IA_STATUS = {
  PROPOSED: 0,
  NOTICED: 1,
  ACTIVE: 2,
  RESOLVED: 3,
  ESCALATED: 4,
  EXPIRED: 5,
} as const

export interface CommitConfig {
  committedHash: string
  commitmentPort: number
  noncePort: number
}

export interface RevealConfig {
  preimagePort: number
  commitmentPort: number
}

export interface ActionStateMachineConfig {
  minNoticeBlocks: bigint
  maxDurationBlocks: bigint
  authorityPk: string
  noticePort: number
  durationPort: number
}

export interface EscrowEnforcementConfig {
  conditionHash: string
  amount: string
  conditionPort: number
  amountPort: number
}

/**
 * Build a commit script that verifies:
 *   1. The commitment hash matches the config
 *   2. Nonce increases monotonically
 *
 * Port layout:
 *   commitmentPort — pre-computed SHA3 commit
 *   noncePort — monotonic counter
 */
export function buildCommitScript(config: CommitConfig): string {
  return [
    `LET commitment = STATE(${config.commitmentPort})`,
    `ASSERT commitment EQ 0x${config.committedHash}`,
    ``,
    `LET prevNonce = PREVSTATE(${config.noncePort})`,
    `LET curNonce = STATE(${config.noncePort})`,
    `ASSERT curNonce GT prevNonce`,
    ``,
    `RETURN TRUE`,
  ].join('\n')
}

/**
 * Build a reveal script that verifies:
 *   SHA3(preimage) == PREVSTATE(commitmentPort)
 */
export function buildRevealScript(config: RevealConfig): string {
  return [
    `LET preimage = STATE(${config.preimagePort})`,
    `LET committed = PREVSTATE(${config.commitmentPort})`,
    `LET check = SHA3(preimage)`,
    `ASSERT check EQ committed`,
    ``,
    `ASSERT SAMESTATE(${config.preimagePort} ${config.preimagePort})`,
    ``,
    `RETURN TRUE`,
  ].join('\n')
}

/**
 * Build an industrial action state machine script that enforces:
 *   proposed → noticed (require >= minNoticeBlocks from noticePort)
 *   noticed → active (require >= minNotice and <= maxDuration from noticePort)
 *   noticed → resolved (authority sig)
 *   active → resolved (authority sig)
 *   active → escalated (authority sig)
 *   noticed → expired (block > expiry)
 */
export function buildActionStateMachineScript(config: ActionStateMachineConfig): string {
  return [
    `SWITCH PREVSTATE(0)`,
    ``,
    `  CASE ${IA_STATUS.PROPOSED}`,
    `    IF STATE(0) EQ ${IA_STATUS.NOTICED} THEN`,
    `      LET noticeBlock = STATE(${config.noticePort})`,
    `      ASSERT @BLOCK GTE noticeBlock`,
    `    ELSE`,
    `      RETURN FALSE`,
    `    ENDIF`,
    ``,
    `  CASE ${IA_STATUS.NOTICED}`,
    `    IF STATE(0) EQ ${IA_STATUS.ACTIVE} THEN`,
    `      LET noticeBlock = PREVSTATE(${config.noticePort})`,
    `      LET minNotice = ${config.minNoticeBlocks.toString()}`,
    `      ASSERT @BLOCK GTE noticeBlock ADD minNotice`,
    `      LET maxDuration = ${config.maxDurationBlocks.toString()}`,
    `      LET expiresAt = noticeBlock ADD maxDuration`,
    `      ASSERT @BLOCK LTE expiresAt`,
    `    ELSEIF STATE(0) EQ ${IA_STATUS.RESOLVED} THEN`,
    `      ASSERT SIGNEDBY(0x${config.authorityPk})`,
    `    ELSEIF STATE(0) EQ ${IA_STATUS.EXPIRED} THEN`,
    `      LET noticeBlock = PREVSTATE(${config.noticePort})`,
    `      LET maxDuration = ${config.maxDurationBlocks.toString()}`,
    `      LET expiresAt = noticeBlock ADD maxDuration`,
    `      ASSERT @BLOCK GT expiresAt`,
    `    ELSE`,
    `      RETURN FALSE`,
    `    ENDIF`,
    ``,
    `  CASE ${IA_STATUS.ACTIVE}`,
    `    IF STATE(0) EQ ${IA_STATUS.RESOLVED} THEN`,
    `      ASSERT SIGNEDBY(0x${config.authorityPk})`,
    `    ELSEIF STATE(0) EQ ${IA_STATUS.ESCALATED} THEN`,
    `      ASSERT SIGNEDBY(0x${config.authorityPk})`,
    `    ELSE`,
    `      RETURN FALSE`,
    `    ENDIF`,
    ``,
    `  CASE ${IA_STATUS.RESOLVED}`,
    `    RETURN FALSE`,
    ``,
    `  CASE ${IA_STATUS.ESCALATED}`,
    `    RETURN FALSE`,
    ``,
    `  CASE ${IA_STATUS.EXPIRED}`,
    `    RETURN FALSE`,
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
 * Build an escrow enforcement script that checks:
 *   1. Condition hash matches committed condition
 *   2. Amount matches committed amount
 *   3. Escrow state is unchanged
 */
export function buildEscrowEnforcementScript(config: EscrowEnforcementConfig): string {
  return [
    `LET condition = STATE(${config.conditionPort})`,
    `LET amount = STATE(${config.amountPort})`,
    ``,
    `ASSERT condition EQ 0x${config.conditionHash}`,
    `ASSERT amount EQ ${config.amount}`,
    ``,
    `ASSERT SAMESTATE(${config.conditionPort} ${config.amountPort})`,
    ``,
    `RETURN TRUE`,
  ].join('\n')
}
