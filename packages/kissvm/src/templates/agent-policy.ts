export interface PaymentIntentConfig {
  riskLimit: string
  allowedRecipient: string
  expiresAt: bigint
  tokenId?: string
}

export function buildPaymentIntentScript(config: PaymentIntentConfig): string {
  const lines: string[] = [
    `LET amount = STATE(20)`,
    `LET limit = 0x${config.riskLimit}`,
    `ASSERT amount LTE limit`,
    `ASSERT STATE(21) EQ 0x${config.allowedRecipient}`,
    `ASSERT @BLOCK LTE ${config.expiresAt.toString()}`,
  ]

  if (config.tokenId !== undefined) {
    lines.push(`ASSERT @TOKENID EQ 0x${config.tokenId}`)
  }

  lines.push(`RETURN TRUE`)
  return lines.join('\n')
}

export interface AgentProposalConfig {
  minConfidence: number
  allowedTransitions: Record<string, string[]>
  expiresAt: bigint
}

export function buildAgentProposalScript(config: AgentProposalConfig): string {
  const lines: string[] = [
    `LET oldStatus = PREVSTATE(20)`,
    `LET newStatus = STATE(20)`,
  ]

  const checks: string[] = []
  for (const [from, tos] of Object.entries(config.allowedTransitions)) {
    for (const to of tos) {
      checks.push(`oldStatus EQ ${from} AND newStatus EQ ${to}`)
    }
  }

  lines.push(`ASSERT ${checks.join(' OR ')}`)
  lines.push(`ASSERT STATE(21) GTE ${config.minConfidence}`)
  lines.push(`ASSERT @BLOCK LTE ${config.expiresAt.toString()}`)
  lines.push(`RETURN TRUE`)
  return lines.join('\n')
}

export interface PolicyEnforcementConfig {
  riskThreshold: string
  policyRules: string[]
  authorityPk: string
  expiresAt: bigint
}

export function buildPolicyEnforcementScript(config: PolicyEnforcementConfig): string {
  const lines: string[] = [
    `LET authority = 0x${config.authorityPk}`,
    `ASSERT SIGNEDBY(authority)`,
    `LET riskScore = STATE(20)`,
    `LET threshold = 0x${config.riskThreshold}`,
    `ASSERT riskScore LTE threshold`,
  ]

  for (const rule of config.policyRules) {
    lines.push(`ASSERT STATE(21) EQ 0x${rule}`)
  }

  lines.push(`ASSERT @BLOCK LTE ${config.expiresAt.toString()}`)
  lines.push(`RETURN TRUE`)
  return lines.join('\n')
}
