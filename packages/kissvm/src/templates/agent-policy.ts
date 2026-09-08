export interface PaymentIntentConfig {
  riskLimit: string
  allowedRecipient: string
  expiresAt: bigint
  tokenId?: string
}

function requireHex(value: string, field: string): string {
  const raw = value.replace(/^0x/i, '')
  if (raw.length === 0 || !/^[0-9a-fA-F]+$/.test(raw)) {
    throw new Error(`${field} must be a hex string; received ${JSON.stringify(value)}`)
  }
  return raw
}

export function buildPaymentIntentScript(config: PaymentIntentConfig): string {
  const recipient = requireHex(config.allowedRecipient, 'allowedRecipient')
  const lines: string[] = [
    `LET amount = STATE(20)`,
    `LET limit = ${config.riskLimit}`,
    `ASSERT amount LTE limit`,
    `ASSERT STATE(21) EQ 0x${recipient}`,
    `ASSERT @BLOCK LTE ${config.expiresAt.toString()}`,
  ]

  if (config.tokenId !== undefined) {
    lines.push(`ASSERT @TOKENID EQ 0x${requireHex(config.tokenId, 'tokenId')}`)
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
  const authority = requireHex(config.authorityPk, 'authorityPk')
  const lines: string[] = [
    `LET authority = 0x${authority}`,
    `ASSERT SIGNEDBY(authority)`,
    `LET riskScore = STATE(20)`,
    `LET threshold = ${config.riskThreshold}`,
    `ASSERT riskScore LTE threshold`,
  ]

  for (const rule of config.policyRules) {
    lines.push(`ASSERT STATE(21) EQ 0x${requireHex(rule, 'policyRules[]')}`)
  }

  lines.push(`ASSERT @BLOCK LTE ${config.expiresAt.toString()}`)
  lines.push(`RETURN TRUE`)
  return lines.join('\n')
}
