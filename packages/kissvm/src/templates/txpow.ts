export interface TxPoWValidationConfig {
  /**
   * Fixed attestor permitted to assert the TxPoW metadata (I1). These ports are
   * transaction state, not network-observed TxPoW measurements, so the script is
   * an *attested metadata constraint* — only the attestor may assert it.
   */
  attestorPk: string
  maxTxPoWSize: bigint
  maxKISSVMOps: bigint
  minTxPoWWork: bigint
  magicPort: number
  opsPort: number
  workPort: number
}

/**
 * RFC-016: renamed from `buildTxPoWValidationScript`. This constrains
 * **attested TxPoW metadata** carried in state; it does not introspect real
 * TxPoW, and it is authorized by a fixed attestor.
 */
export function buildAttestedTxPoWMetaScript(config: TxPoWValidationConfig): string {
  const attestor = config.attestorPk.replace(/^0x/i, '')
  return [
    `LET maxTxPoWSize = ${config.maxTxPoWSize.toString()}`,
    `LET txSize = STATE(${config.magicPort})`,
    `ASSERT txSize LTE maxTxPoWSize`,
    ``,
    `LET maxOps = ${config.maxKISSVMOps.toString()}`,
    `LET ops = STATE(${config.opsPort})`,
    `ASSERT ops LTE maxOps`,
    ``,
    `LET minWork = ${config.minTxPoWWork.toString()}`,
    `LET work = STATE(${config.workPort})`,
    `ASSERT work GTE minWork`,
    ``,
    `ASSERT SIGNEDBY(0x${attestor})`,
    ``,
    `RETURN TRUE`,
  ].join('\n')
}

/** @deprecated Use {@link buildAttestedTxPoWMetaScript} (RFC-016). */
export function buildTxPoWValidationScript(config: TxPoWValidationConfig): string {
  return buildAttestedTxPoWMetaScript(config)
}

export function buildMagicConstantsScript(config: TxPoWValidationConfig): string {
  const attestor = config.attestorPk.replace(/^0x/i, '')
  return [
    `LET maxTxPoWSize = STATE(${config.magicPort})`,
    `ASSERT maxTxPoWSize EQ ${config.maxTxPoWSize.toString()}`,
    ``,
    `LET maxOps = STATE(${config.opsPort})`,
    `ASSERT maxOps EQ ${config.maxKISSVMOps.toString()}`,
    ``,
    `LET work = STATE(${config.workPort})`,
    `ASSERT work EQ ${config.minTxPoWWork.toString()}`,
    ``,
    `ASSERT SIGNEDBY(0x${attestor})`,
    ``,
    `RETURN TRUE`,
  ].join('\n')
}
