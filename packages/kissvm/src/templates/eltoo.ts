export interface EltooConfig {
  partyPks: [string, string]
  settlementPort?: number
  sequencePort?: number
  reclaimTimelock?: bigint
}

export function buildEltooChannelScript(config: EltooConfig): string {
  const settlementPort = config.settlementPort ?? 100
  const sequencePort = config.sequencePort ?? 101
  const timelock = config.reclaimTimelock ?? 256n
  const [pkA, pkB] = config.partyPks

  return [
    `LET SETTLEMENT = STATE(${settlementPort})`,
    `LET SEQUENCE = STATE(${sequencePort})`,
    `LET PREVSEQUENCE = PREVSTATE(${sequencePort})`,
    `ASSERT MULTISIG(2 0x${pkA} 0x${pkB})`,
    `IF SETTLEMENT THEN`,
    `  IF SEQUENCE EQ PREVSEQUENCE AND @COINAGE GTE ${timelock.toString()} THEN RETURN TRUE ENDIF`,
    `ELSE`,
    `  IF SEQUENCE GT PREVSEQUENCE THEN RETURN TRUE ENDIF`,
    `ENDIF`,
    `RETURN FALSE`,
  ].join('\n')
}

export function buildEltooFundingScript(config: EltooConfig): string {
  const [pkA, pkB] = config.partyPks

  return [
    `ASSERT MULTISIG(2 0x${pkA} 0x${pkB})`,
    `RETURN TRUE`,
  ].join('\n')
}

export interface FactoryConfig {
  participantPks: string[]
  settlementPort?: number
  settlementCoinage?: bigint
}

export function buildFactoryFundingScript(config: FactoryConfig): string {
  const n = config.participantPks.length
  const pks = config.participantPks.map(pk => `0x${pk}`).join(' ')

  if (n < 2) {
    throw new Error(`Factory requires at least 2 participants, got ${n}`)
  }

  const settlementPort = config.settlementPort ?? 100
  const coinage = config.settlementCoinage ?? 1n

  return [
    `LET SETTLEMENT = STATE(${settlementPort})`,
    `ASSERT MULTISIG(${n} ${pks})`,
    `IF SETTLEMENT THEN`,
    `  IF @COINAGE GTE ${coinage.toString()} THEN RETURN TRUE ENDIF`,
    `ELSE`,
    `  RETURN TRUE`,
    `ENDIF`,
    `RETURN FALSE`,
  ].join('\n')
}

export function buildEltooSettlementScript(config: EltooConfig): string {
  const settlementPort = config.settlementPort ?? 100
  const sequencePort = config.sequencePort ?? 101
  const timelock = config.reclaimTimelock ?? 256n
  const [pkA, pkB] = config.partyPks

  return [
    `LET SETTLEMENT = STATE(${settlementPort})`,
    `LET SEQUENCE = STATE(${sequencePort})`,
    `LET PREVSEQUENCE = PREVSTATE(${sequencePort})`,
    `ASSERT MULTISIG(2 0x${pkA} 0x${pkB})`,
    `ASSERT SETTLEMENT EQ 1`,
    `ASSERT SEQUENCE EQ PREVSEQUENCE`,
    `ASSERT @COINAGE GTE ${timelock.toString()}`,
    `RETURN TRUE`,
  ].join('\n')
}
