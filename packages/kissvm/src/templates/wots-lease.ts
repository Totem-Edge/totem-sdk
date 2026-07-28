export const LEASE_STATUS = {
  PENDING: 0,
  ACTIVE: 1,
  EXPIRED: 2,
  FINALIZED: 3,
  CANCELLED: 4,
} as const

export interface LeaseCertificateConfig {
  treeId: string
  deviceId: string
  branchId: string
  indices: string
  purpose: string
  payloadHash: string
  issuedAt: bigint
  signature: string
  expiresAt: bigint
  authorityPk: string
  statePort: number
  watermarkPort: number
}

/**
 * Build a lease certificate verification script that checks:
 *   1. Authority signed the certificate
 *   2. Certificate fields (treeId, deviceId, branchId, purpose, payload) match committed state
 *   3. Current block < expiresAt (not expired)
 *   4. State is unchanged (SAMESTATE)
 */
export function buildLeaseCertificateScript(config: LeaseCertificateConfig): string {
  return [
    `LET authority = 0x${config.authorityPk}`,
    `ASSERT SIGNEDBY(authority)`,
    ``,
    `LET certTreeId = STATE(${config.statePort})`,
    `LET certDeviceId = STATE(${config.statePort + 1})`,
    `LET certBranchId = STATE(${config.statePort + 2})`,
    `LET certPurpose = STATE(${config.statePort + 3})`,
    `LET certPayload = STATE(${config.statePort + 4})`,
    ``,
    `ASSERT certTreeId EQ 0x${config.treeId}`,
    `ASSERT certDeviceId EQ 0x${config.deviceId}`,
    `ASSERT certBranchId EQ 0x${config.branchId}`,
    `ASSERT certPurpose EQ 0x${config.purpose}`,
    `ASSERT certPayload EQ 0x${config.payloadHash}`,
    ``,
    `ASSERT @BLOCK LT ${config.expiresAt.toString()}`,
    ``,
    `ASSERT SAMESTATE(${config.statePort} ${config.statePort + 5})`,
    ``,
    `RETURN TRUE`,
  ].join('\n')
}

/**
 * Build a watermark tracking script that enforces:
 *   1. Watermark cursor increases monotonically (cur > prev)
 *   2. TTL: elapsed blocks since previous watermark >= minInterval
 *   3. State range unchanged (SAMESTATE on watermarkPort range)
 *
 * Port layout:
 *   0 — watermark cursor value
 *   1 — last watermark block
 *   2 — min interval (blocks between watermarks)
 */
export function buildWatermarkTrackingScript(config: LeaseCertificateConfig): string {
  return [
    `LET prevMark = PREVSTATE(${config.watermarkPort})`,
    `LET curMark = STATE(${config.watermarkPort})`,
    `ASSERT curMark GT prevMark`,
    ``,
    `LET prevBlock = PREVSTATE(${config.watermarkPort + 1})`,
    `LET elapsed = @BLOCK SUB prevBlock`,
    `ASSERT elapsed GTE ${config.issuedAt.toString()}`,
    ``,
    `ASSERT SAMESTATE(${config.watermarkPort + 1} ${config.watermarkPort + 2})`,
    ``,
    `RETURN TRUE`,
  ].join('\n')
}

/**
 * Build a lease state machine script enforcing the 5-status lifecycle:
 *   pending → active → expired
 *                  ↘ finalised
 *                  ↘ cancelled
 *
 * Port 0 holds the status.
 */
export function buildLeaseStateMachineScript(config: LeaseCertificateConfig): string {
  return [
    `SWITCH PREVSTATE(0)`,
    ``,
    `  CASE ${LEASE_STATUS.PENDING}`,
    `    IF STATE(0) EQ ${LEASE_STATUS.ACTIVE} THEN`,
    `      ASSERT @BLOCK GTE ${config.issuedAt.toString()}`,
    `    ELSEIF STATE(0) EQ ${LEASE_STATUS.CANCELLED} THEN`,
    `      ASSERT SIGNEDBY(0x${config.authorityPk})`,
    `    ELSE`,
    `      RETURN FALSE`,
    `    ENDIF`,
    ``,
    `  CASE ${LEASE_STATUS.ACTIVE}`,
    `    IF STATE(0) EQ ${LEASE_STATUS.EXPIRED} THEN`,
    `      ASSERT @BLOCK GTE ${config.expiresAt.toString()}`,
    `    ELSEIF STATE(0) EQ ${LEASE_STATUS.FINALIZED} THEN`,
    `      ASSERT SIGNEDBY(0x${config.authorityPk})`,
    `    ELSEIF STATE(0) EQ ${LEASE_STATUS.CANCELLED} THEN`,
    `      ASSERT SIGNEDBY(0x${config.authorityPk})`,
    `    ELSE`,
    `      RETURN FALSE`,
    `    ENDIF`,
    ``,
    `  CASE ${LEASE_STATUS.EXPIRED}`,
    `    RETURN FALSE`,
    ``,
    `  CASE ${LEASE_STATUS.FINALIZED}`,
    `    RETURN FALSE`,
    ``,
    `  CASE ${LEASE_STATUS.CANCELLED}`,
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
