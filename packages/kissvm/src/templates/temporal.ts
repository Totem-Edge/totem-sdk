export type ReleaseCurve = 'linear' | 'cliff' | 'deadline' | 'window' | 'rate-limit' | 'decay'

export interface TemporalConfig {
  curve: ReleaseCurve
  startPort: number
  endPort?: number
  totalPort?: number
  beneficiaryPort?: number
  governancePort?: number
  cliffPort?: number
  cliffBlock?: bigint
  deadlineBlock?: bigint
  windowStartBlock?: bigint
  windowEndBlock?: bigint
  periodBlocks?: bigint
  maxPerPeriod?: bigint
  decayConstant?: bigint
  beneficiary?: string
  tokenId?: string
}

export const MAX_DECIMAL = 1000000n

function requirePort(config: TemporalConfig, port: number | undefined, name: string): number {
  if (port === undefined) throw new Error(`TemporalConfig.${name} is required for curve '${config.curve}'`)
  return port
}

/**
 * Linear release: vested = total * elapsed / duration, where
 * duration = STATE(endPort) - STATE(startPort).
 */
export function buildLinearRelease(config: TemporalConfig): string {
  const startPort = config.startPort
  const endPort = requirePort(config, config.endPort, 'endPort')
  const totalPort = requirePort(config, config.totalPort, 'totalPort')
  const beneficiaryPort = requirePort(config, config.beneficiaryPort, 'beneficiaryPort')
  const beneficiary = config.beneficiary
  if (!beneficiary) throw new Error('TemporalConfig.beneficiary is required for linear release')

  const lines: string[] = [
    `LET vestStart = STATE(${startPort})`,
    `LET vestEnd = STATE(${endPort})`,
    `LET total = STATE(${totalPort})`,
    `LET prevClaimed = PREVSTATE(${beneficiaryPort})`,
    `LET elapsed = @BLOCK SUB vestStart`,
    `LET duration = vestEnd SUB vestStart`,
    `LET vested = total MUL elapsed DIV duration`,
    `LET claimable = vested SUB prevClaimed`,
    `ASSERT @BLOCK GT vestStart`,
    `ASSERT claimable GT 0`,
    `ASSERT SIGNEDBY(0x${beneficiary})`,
    `ASSERT VERIFYOUT(@INPUT 0x${beneficiary} claimable @TOKENID TRUE)`,
    `STORE STATE(${beneficiaryPort}) WITH prevClaimed ADD claimable`,
    `RETURN TRUE`,
  ]
  return lines.join('\n')
}

/**
 * Cliff release: nothing until cliffBlock, then linear from cliff to end.
 */
export function buildCliffRelease(config: TemporalConfig): string {
  const startPort = config.startPort
  const endPort = requirePort(config, config.endPort, 'endPort')
  const cliffPort = requirePort(config, config.cliffPort, 'cliffPort')
  const totalPort = requirePort(config, config.totalPort, 'totalPort')
  const beneficiaryPort = requirePort(config, config.beneficiaryPort, 'beneficiaryPort')
  const beneficiary = config.beneficiary
  if (!beneficiary) throw new Error('TemporalConfig.beneficiary is required for cliff release')

  const lines: string[] = [
    `LET vestStart = STATE(${startPort})`,
    `LET vestEnd = STATE(${endPort})`,
    `LET cliffBlock = STATE(${cliffPort})`,
    `LET total = STATE(${totalPort})`,
    `LET prevClaimed = PREVSTATE(${beneficiaryPort})`,
    `ASSERT @BLOCK GT cliffBlock`,
    `LET cliffElapsed = @BLOCK SUB cliffBlock`,
    `LET duration = vestEnd SUB cliffBlock`,
    `LET vested = total MUL cliffElapsed DIV duration`,
    `LET claimable = vested SUB prevClaimed`,
    `ASSERT claimable GT 0`,
    `ASSERT SIGNEDBY(0x${beneficiary})`,
    `ASSERT VERIFYOUT(@INPUT 0x${beneficiary} claimable @TOKENID TRUE)`,
    `STORE STATE(${beneficiaryPort}) WITH prevClaimed ADD claimable`,
    `RETURN TRUE`,
  ]
  return lines.join('\n')
}

export function buildDeadlineScript(config: TemporalConfig): string {
  const beneficiary = config.beneficiary
  const lines: string[] = [
    `ASSERT @BLOCK LT ${config.deadlineBlock!.toString()}`,
  ]
  if (beneficiary) lines.push(`ASSERT SIGNEDBY(0x${beneficiary})`)
  lines.push(`RETURN TRUE`)
  return lines.join('\n')
}

export function buildWindowScript(config: TemporalConfig): string {
  const lines: string[] = [
    `ASSERT @BLOCK GTE ${config.windowStartBlock!.toString()}`,
    `ASSERT @BLOCK LTE ${config.windowEndBlock!.toString()}`,
    `RETURN TRUE`,
  ]
  return lines.join('\n')
}

export function buildRateLimitScript(config: TemporalConfig): string {
  const beneficiaryPort = requirePort(config, config.beneficiaryPort, 'beneficiaryPort')
  const lines: string[] = [
    `LET maxUsed = ${config.maxPerPeriod!.toString()}`,
    `LET used = PREVSTATE(${beneficiaryPort})`,
    `ASSERT used LT maxUsed`,
    `STORE STATE(${beneficiaryPort}) WITH used ADD 1`,
    `RETURN TRUE`,
  ]
  return lines.join('\n')
}

export function buildDecayScript(config: TemporalConfig): string {
  const startPort = config.startPort
  const totalPort = requirePort(config, config.totalPort, 'totalPort')
  const lines: string[] = [
    `LET vestStart = STATE(${startPort})`,
    `LET total = STATE(${totalPort})`,
    `LET k = ${config.decayConstant!.toString()}`,
    `LET elapsed = @BLOCK SUB vestStart`,
    `LET numerator = ${MAX_DECIMAL.toString()}`,
    `LET denominator = ${MAX_DECIMAL.toString()} ADD k MUL elapsed`,
    `LET value = total MUL numerator DIV denominator`,
    `RETURN TRUE`,
  ]
  return lines.join('\n')
}

export function buildTemporalScript(config: TemporalConfig): string {
  switch (config.curve) {
    case 'linear':
      return buildLinearRelease(config)
    case 'cliff':
      return buildCliffRelease(config)
    case 'deadline':
      return buildDeadlineScript(config)
    case 'window':
      return buildWindowScript(config)
    case 'rate-limit':
      return buildRateLimitScript(config)
    case 'decay':
      return buildDecayScript(config)
  }
}

export function computeRelease(
  config: TemporalConfig,
  block: bigint,
  state: Map<number, bigint>,
): bigint {
  switch (config.curve) {
    case 'linear': {
      const vestStart = state.get(config.startPort)!
      const vestEnd = state.get(config.endPort!)!
      const total = state.get(config.totalPort!)!
      const prevClaimed = state.get(config.beneficiaryPort!) ?? 0n
      if (block <= vestStart) return 0n
      const elapsed = block - vestStart
      const duration = vestEnd - vestStart
      if (duration <= 0n) return 0n
      const vested = total * elapsed / duration
      const claimable = vested - prevClaimed
      return claimable > 0n ? claimable : 0n
    }
    case 'cliff': {
      const cliffBlock = state.get(config.cliffPort!)!
      const vestEnd = state.get(config.endPort!)!
      const total = state.get(config.totalPort!)!
      const prevClaimed = state.get(config.beneficiaryPort!) ?? 0n
      if (block <= cliffBlock) return 0n
      const cliffElapsed = block - cliffBlock
      const duration = vestEnd - cliffBlock
      if (duration <= 0n) return 0n
      const vested = total * cliffElapsed / duration
      const claimable = vested - prevClaimed
      return claimable > 0n ? claimable : 0n
    }
    case 'deadline': {
      return block < config.deadlineBlock! ? 1n : 0n
    }
    case 'window': {
      return block >= config.windowStartBlock! && block <= config.windowEndBlock! ? 1n : 0n
    }
    case 'rate-limit': {
      const used = state.get(config.beneficiaryPort!) ?? 0n
      return used < config.maxPerPeriod! ? 1n : 0n
    }
    case 'decay': {
      const vestStart = state.get(config.startPort)!
      const total = state.get(config.totalPort!)!
      const k = config.decayConstant ?? 0n
      const elapsed = block - vestStart
      const numerator = MAX_DECIMAL
      const denominator = MAX_DECIMAL + k * elapsed
      return total * numerator / denominator
    }
  }
}
