export interface TxPoWValidationConfig {
  maxTxPoWSize: bigint
  maxKISSVMOps: bigint
  minTxPoWWork: bigint
  magicPort: number
  opsPort: number
  workPort: number
}

export function buildTxPoWValidationScript(config: TxPoWValidationConfig): string {
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
    `ASSERT @BLOCK GTE minWork`,
    ``,
    `RETURN TRUE`,
  ].join('\n')
}

export function buildMagicConstantsScript(config: TxPoWValidationConfig): string {
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
    `RETURN TRUE`,
  ].join('\n')
}
