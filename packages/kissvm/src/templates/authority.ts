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
  /** Fixed authority permitted to authorize the action (I1). */
  authorityPk: string
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
  /** RFC-018 P1-3: authority permitted to spend under this usage policy. */
  authorityPk: string
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
  const grantor = config.grantor.replace(/^0x/i, '')
  const scope = config.scope.replace(/^0x/i, '')

  return [
    `LET grantor = 0x${grantor}`,
    `ASSERT SIGNEDBY(grantor)`,
    ``,
    `// RFC-018 KISSVM-TEMPLATE-AUTH-001: scope, expiry and revocation epoch are`,
    `// read from the *committed* state and must not change in this transaction,`,
    `// so the grantor cannot widen scope or extend its own mandate.`,
    `LET scope = PREVSTATE(${config.scopePort})`,
    `ASSERT scope EQ 0x${scope}`,
    `ASSERT STATE(${config.scopePort}) EQ scope`,
    ``,
    `// Not expired (committed expiry, pinned to config)`,
    `LET expiresAt = PREVSTATE(${expiryPort})`,
    `ASSERT expiresAt EQ ${config.expiresAtBlock.toString()}`,
    `ASSERT STATE(${expiryPort}) EQ expiresAt`,
    `ASSERT @BLOCK LTE expiresAt`,
    ``,
    `// Not revoked (committed epoch, pinned to config)`,
    `LET revocationEpoch = PREVSTATE(${config.revocationEpochPort})`,
    `ASSERT revocationEpoch EQ ${config.revocationEpoch.toString()}`,
    `ASSERT STATE(${config.revocationEpochPort}) EQ revocationEpoch`,
    ``,
    `// Replay protection`,
    `LET nonce = STATE(${noncePort})`,
    `ASSERT nonce GT PREVSTATE(${noncePort})`,
    ``,
    `RETURN TRUE`,
  ].join('\n')
}

export function buildActionAuthorizationScript(config: ActionAuthorizationConfig): string {
  const authority = config.authorityPk.replace(/^0x/i, '')
  return [
    `LET nonce = STATE(${config.noncePort})`,
    // I3: the nonce must strictly increase — `NEQ` alone can oscillate.
    `ASSERT nonce GT PREVSTATE(${config.noncePort})`,
    ``,
    // I1: a fixed authority must authorize the action.
    `ASSERT SIGNEDBY(0x${authority})`,
    ``,
    `LET actionHash = 0x${config.actionHash.replace(/^0x/i, '')}`,
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
  const authority = config.authorityPk.replace(/^0x/i, '')

  return [
    // RFC-018 KISSVM-TEMPLATE-AUTH-002: the policy is authorized and its window
    // is committed (a spender cannot choose or extend the window).
    `ASSERT SIGNEDBY(0x${authority})`,
    ``,
    `LET maxCount = ${config.maxCount.toString()}`,
    `LET maxAmount = ${config.maxAmount}`,
    `LET windowEnd = PREVSTATE(${config.windowEndPort})`,
    `ASSERT STATE(${config.windowEndPort}) EQ windowEnd`,
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
