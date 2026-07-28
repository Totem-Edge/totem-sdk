export interface StateChainConfig {
  sePk: string
  reclaimTimelock: bigint
  ownerPort?: number
}

export const DEFAULT_RECLAIM_TIMELOCK = 256n

export function buildStatechainScript(config: StateChainConfig): string {
  const ownerPort = config.ownerPort ?? 0
  const timelock = config.reclaimTimelock

  return [
    `LET OWNER = STATE(${ownerPort})`,
    `IF @COINAGE GTE ${timelock.toString()} THEN`,
    `  RETURN SIGNEDBY(OWNER)`,
    `ENDIF`,
    `ASSERT MULTISIG(2 OWNER 0x${config.sePk})`,
    `RETURN TRUE`,
  ].join('\n')
}

export function buildStatechainOwnerRotationScript(config: StateChainConfig): string {
  const ownerPort = config.ownerPort ?? 0

  return [
    `LET prevOwner = PREVSTATE(${ownerPort})`,
    `LET newOwner = STATE(${ownerPort})`,
    `ASSERT prevOwner NE newOwner`,
    `ASSERT newOwner NE 0x00`,
    `ASSERT SIGNEDBY(prevOwner)`,
    `ASSERT MULTISIG(2 newOwner 0x${config.sePk})`,
    `RETURN TRUE`,
  ].join('\n')
}
