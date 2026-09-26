export interface StateChainConfig {
  sePk: string
  reclaimTimelock: bigint
  ownerPort?: number
}

export const DEFAULT_RECLAIM_TIMELOCK = 256n

export function buildStatechainScript(config: StateChainConfig): string {
  const ownerPort = config.ownerPort ?? 0
  const timelock = config.reclaimTimelock

  // I1 (RFC-016): the reclaim branch authenticates the *committed* owner
  // (`PREVSTATE`), never a mutable current-state value, and requires owner
  // continuity so an attacker cannot substitute their own key after the timelock.
  return [
    `LET prevOwner = PREVSTATE(${ownerPort})`,
    `IF @COINAGE GTE ${timelock.toString()} THEN`,
    `  ASSERT SIGNEDBY(prevOwner)`,
    `  ASSERT STATE(${ownerPort}) EQ prevOwner`,
    `  RETURN TRUE`,
    `ENDIF`,
    `ASSERT MULTISIG(2 STATE(${ownerPort}) 0x${config.sePk})`,
    `RETURN TRUE`,
  ].join('\n')
}

export function buildStatechainOwnerRotationScript(config: StateChainConfig): string {
  const ownerPort = config.ownerPort ?? 0

  return [
    `LET prevOwner = PREVSTATE(${ownerPort})`,
    `LET newOwner = STATE(${ownerPort})`,
    `ASSERT prevOwner NEQ newOwner`,
    `ASSERT newOwner NEQ 0x00`,
    `ASSERT SIGNEDBY(prevOwner)`,
    `ASSERT MULTISIG(2 newOwner 0x${config.sePk})`,
    `RETURN TRUE`,
  ].join('\n')
}
