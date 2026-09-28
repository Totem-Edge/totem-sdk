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
  //
  // RFC-018 KISSVM-MULTISIG-001: Minima's MULTISIG counts *positions* (verified
  // against the C++ node), so a mutable key would let a spender set the owner
  // position to the SE key and satisfy 2-of-2 with one signature. The normal
  // branch therefore uses the committed owner (`PREVSTATE`), requires owner
  // continuity, and asserts the two keys are distinct.
  return [
    `LET prevOwner = PREVSTATE(${ownerPort})`,
    `LET se = 0x${config.sePk}`,
    `IF @COINAGE GTE ${timelock.toString()} THEN`,
    `  ASSERT SIGNEDBY(prevOwner)`,
    `  ASSERT STATE(${ownerPort}) EQ prevOwner`,
    `  RETURN TRUE`,
    `ENDIF`,
    `ASSERT prevOwner NEQ se`,
    `ASSERT STATE(${ownerPort}) EQ prevOwner`,
    `ASSERT MULTISIG(2 prevOwner se)`,
    `RETURN TRUE`,
  ].join('\n')
}

export function buildStatechainOwnerRotationScript(config: StateChainConfig): string {
  const ownerPort = config.ownerPort ?? 0

  // RFC-018 KISSVM-MULTISIG-001: `newOwner` must differ from the SE key or the
  // 2-of-2 MULTISIG collapses to 1-of-1 (one SE signature fills both positions).
  return [
    `LET prevOwner = PREVSTATE(${ownerPort})`,
    `LET newOwner = STATE(${ownerPort})`,
    `LET se = 0x${config.sePk}`,
    `ASSERT prevOwner NEQ newOwner`,
    `ASSERT newOwner NEQ 0x00`,
    `ASSERT newOwner NEQ se`,
    `ASSERT SIGNEDBY(prevOwner)`,
    `ASSERT MULTISIG(2 newOwner se)`,
    `RETURN TRUE`,
  ].join('\n')
}
