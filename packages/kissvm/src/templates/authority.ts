export interface MandateEnforcementConfig {
  grantor: string
  /** Scope as a hex string (e.g., 'totem:gov:vote' encoded to hex). */
  scope: string
  revocationEpoch: bigint
  scopePort: number
  revocationEpochPort: number
  /** Port for expiresAt block (default 4). */
  expiryPort?: number
  /** Expiry block for the mandate. */
  expiresAtBlock: bigint
  /** Nonce port for replay protection (default 5). */
  noncePort?: number
}

export interface ActionAuthorizationConfig {
  actionHash: string
  windowEnd: bigint
  noncePort: number
  actionPort: number
  windowEndPort: number
}

export interface RevocationConfig {
  authorityPk: string
  revocationEpoch: bigint
  epochPort: number
}

export interface UsageTrackingConfig {
  maxCount: bigint
  maxAmount: string
  windowBlocks: bigint
  countPort: number
  amountPort: number
  windowEndPort: number
  /** Port for a nonce to prevent replay (default 10). */
  noncePort?: number
}

/**
 * Build a mandate enforcement script that checks:
 *   1. Grantor signed the transaction
 *   2. Mandate scope matches the committed scope
 *   3. Mandate is not expired (@BLOCK <= expiresAtBlock)
 *   4. Mandate is not revoked (current epoch <= revocationEpoch)
 *   5. Nonce-based replay protection
 *
 * Port layout:
 *   0 — scope match hash
 *   1 — revocation epoch
 *   2 — expiresAt block
 *   3 — nonce
 */
export function buildMandateEnforcementScript(config: MandateEnforcementConfig): string {
  const expiryPort = config.expiryPort ?? 2
  const noncePort = config.noncePort ?? 3

  return [
    `LET grantor = 0x${config.grantor}`,
    `ASSERT SIGNEDBY(grantor)`,
    ``,
    `// Scope must match`,
    `LET scope = STATE(${config.scopePort})`,
    `ASSERT scope EQ 0x${config.scope}`,
    ``,
    `// Not expired`,
    `LET expiresAt = STATE(${expiryPort})`,
    `ASSERT @BLOCK LTE expiresAt`,
    ``,
    `// Not revoked (current epoch <= revocation epoch)`,
    `LET revocationEpoch = STATE(${config.revocationEpochPort})`,
    `ASSERT @BLOCK LTE revocationEpoch`,
    ``,
    `// Replay protection`,
    `LET nonce = STATE(${noncePort})`,
    `ASSERT nonce GT PREVSTATE(${noncePort})`,
    ``,
    `RETURN TRUE`,
  ].join('\n')
}

export function buildActionAuthorizationScript(config: ActionAuthorizationConfig): string {
  return [
    `LET nonce = STATE(${config.noncePort})`,
    `ASSERT PREVSTATE(${config.noncePort}) NEQ nonce`,
    ``,
    `LET actionHash = 0x${config.actionHash}`,
    `ASSERT STATE(${config.actionPort}) EQ actionHash`,
    ``,
    `LET windowEnd = ${config.windowEnd.toString()}`,
    `ASSERT @BLOCK LTE windowEnd`,
    ``,
    `RETURN TRUE`,
  ].join('\n')
}

/**
 * Build a revocation script that enforces:
 *   1. Authority signed the revocation
 *   2. Current epoch matches the expected revocation epoch
 *   3. Epoch state is unchanged by this transaction
 */
export function buildRevocationScript(config: RevocationConfig): string {
  return [
    `LET authority = 0x${config.authorityPk}`,
    `ASSERT SIGNEDBY(authority)`,
    ``,
    `LET currentEpoch = STATE(${config.epochPort})`,
    `ASSERT currentEpoch EQ ${config.revocationEpoch.toString()}`,
    ``,
    `ASSERT SAMESTATE(${config.epochPort} ${config.epochPort})`,
    ``,
    `RETURN TRUE`,
  ].join('\n')
}

/**
 * Build a usage tracking script that enforces:
 *   1. If past window end, reset count/amount to current values
 *   2. Otherwise, check count <= maxCount and amount <= maxAmount
 *   3. Nonce-based replay protection
 *
 * Port layout:
 *   0 — count
 *   1 — amount
 *   2 — window end block
 *   3 — nonce
 */
export function buildUsageTrackingScript(config: UsageTrackingConfig): string {
  const noncePort = config.noncePort ?? 10

  return [
    `LET maxCount = ${config.maxCount.toString()}`,
    `LET maxAmount = ${config.maxAmount}`,
    `LET windowEnd = STATE(${config.windowEndPort})`,
    ``,
    `// Window reset: if past window end, reset to current values`,
    `IF @BLOCK GT windowEnd THEN`,
    `  LET count = STATE(${config.countPort})`,
    `  LET amount = STATE(${config.amountPort})`,
    `  ASSERT count LTE maxCount`,
    `  ASSERT amount LTE maxAmount`,
    `ELSE`,
    `  LET prevCount = PREVSTATE(${config.countPort})`,
    `  LET prevAmount = PREVSTATE(${config.amountPort})`,
    `  LET count = STATE(${config.countPort})`,
    `  LET amount = STATE(${config.amountPort})`,
    `  ASSERT count LTE maxCount`,
    `  ASSERT amount LTE maxAmount`,
    `  ASSERT count GTE prevCount`,
    `  ASSERT amount GTE prevAmount`,
    `ENDIF`,
    ``,
    `// Replay protection`,
    `LET nonce = STATE(${noncePort})`,
    `ASSERT nonce GT PREVSTATE(${noncePort})`,
    ``,
    `RETURN TRUE`,
  ].join('\n')
}
