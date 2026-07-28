export interface ProofConfig {
  authorityPk: string
  expiresAt: bigint
  anchorBlock: bigint
  proofKind: 'capability' | 'revocation' | 'delegation'
  confirmedAtPort: number
}

export function buildProofAnchorScript(config: ProofConfig): string {
  const lines: string[] = [
    `LET authority = 0x${config.authorityPk}`,
    `ASSERT SIGNEDBY(authority)`,
    ``,
    `LET anchorBlock = ${config.anchorBlock.toString()}`,
    `LET confirmedBlock = STATE(${config.confirmedAtPort})`,
    `ASSERT confirmedBlock GTE anchorBlock`,
    ``,
    `LET expiresAt = ${config.expiresAt.toString()}`,
    `ASSERT @BLOCK LTE expiresAt`,
    ``,
    `RETURN TRUE`,
  ]
  return lines.join('\n')
}

export function buildCapabilityProofScript(config: ProofConfig): string {
  const lines: string[] = [
    `LET authority = 0x${config.authorityPk}`,
    `ASSERT SIGNEDBY(authority)`,
    ``,
    `LET kind = STATE(0)`,
    `ASSERT kind EQ 0x6361706162696c697479`,
    ``,
    `LET scope = STATE(1)`,
    `ASSERT PREVSTATE(1) EQ scope`,
    ``,
    `LET expiresAt = ${config.expiresAt.toString()}`,
    `ASSERT @BLOCK LTE expiresAt`,
    ``,
    `RETURN TRUE`,
  ]
  return lines.join('\n')
}

export function buildRevocationProofScript(config: ProofConfig): string {
  const lines: string[] = [
    `LET authority = 0x${config.authorityPk}`,
    `ASSERT SIGNEDBY(authority)`,
    ``,
    `LET revocationEpoch = STATE(0)`,
    `ASSERT revocationEpoch EQ ${config.anchorBlock.toString()}`,
    ``,
    `ASSERT SAMESTATE(0 2)`,
    ``,
    `RETURN TRUE`,
  ]
  return lines.join('\n')
}

export function buildProofDelegationScript(config: ProofConfig): string {
  const lines: string[] = [
    `LET delegator = STATE(0)`,
    `LET delegate = STATE(1)`,
    ``,
    `ASSERT SIGNEDBY(delegator)`,
    `ASSERT SIGNEDBY(delegate)`,
    ``,
    `LET expiresAt = ${config.expiresAt.toString()}`,
    `ASSERT @BLOCK LTE expiresAt`,
    ``,
    `RETURN TRUE`,
  ]
  return lines.join('\n')
}
