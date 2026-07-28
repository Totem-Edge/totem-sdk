export interface ManifestBindingConfig {
  publisherPk: string
  manifestHash: string
}

export interface CapabilityConfig {
  agentPk: string
  permissions: string[]
  expiresAt: bigint
}

export interface ManifestExpiryConfig {
  signedAt: bigint
  expiresAt: bigint
  subscriptionInterval: bigint
}

export function buildManifestBindingScript(config: ManifestBindingConfig): string {
  const lines: string[] = [
    `LET publisher = 0x${config.publisherPk}`,
    `ASSERT SIGNEDBY(publisher)`,
    ``,
    `LET manifestData = STATE(0)`,
    `LET computedHash = SHA3(manifestData)`,
    `ASSERT computedHash EQ 0x${config.manifestHash}`,
  ]

  lines.push(``, `RETURN TRUE`)
  return lines.join('\n')
}

export function buildCapabilityScript(config: CapabilityConfig): string {
  const lines: string[] = [
    `LET agent = 0x${config.agentPk}`,
    `ASSERT SIGNEDBY(agent)`,
    ``,
    `LET requestedPerm = STATE(0)`,
  ]

  if (config.permissions.length > 0) {
    lines.push(`ASSERT ${config.permissions.map(p => `requestedPerm EQ 0x${p}`).join(' OR ')}`)
  }

  lines.push(
    ``,
    `ASSERT @BLOCK LTE ${config.expiresAt.toString()}`,
    ``,
    `RETURN TRUE`,
  )

  return lines.join('\n')
}

export function buildManifestExpiryScript(config: ManifestExpiryConfig): string {
  return [
    `LET signedAt = ${config.signedAt.toString()}`,
    `LET expiresAt = ${config.expiresAt.toString()}`,
    `LET interval = ${config.subscriptionInterval.toString()}`,
    ``,
    `ASSERT STATE(0) EQ signedAt`,
    `ASSERT STATE(1) EQ expiresAt`,
    ``,
    `ASSERT @BLOCK GTE signedAt`,
    `ASSERT @BLOCK LTE expiresAt`,
    ``,
    `ASSERT PREVSTATE(2) EQ 0 OR @BLOCK SUB PREVSTATE(2) GTE interval`,
    ``,
    `RETURN TRUE`,
  ].join('\n')
}
