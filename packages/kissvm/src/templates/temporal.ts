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

export function buildLinearRelease(config: TemporalConfig): string {
  const lines: string[] = [
    `LET vestStart = STATE(${config.startPort})`,
    `LET total = STATE(${config.totalPort!})`,
    `LET prevClaimed = PREVSTATE(${config.beneficiaryPort!})`,
    `LET elapsed = SUB(@BLOCK vestStart)`,
    `LET vested = DIV(MUL(total elapsed) total)`,
    `LET claimable = SUB(vested prevClaimed)`,
    `ASSERT @BLOCK GT vestStart`,
    `ASSERT claimable GT 0`,
    `ASSERT SIGNEDBY(0x${config.beneficiary!})`,
    `ASSERT VERIFYOUT(@INPUT 0x${config.beneficiary!} claimable @TOKENID TRUE)`,
    `STORE STATE(${config.beneficiaryPort!}, ADD(prevClaimed claimable))`,
  ]
  return lines.join('\n')
}

export function buildCliffRelease(config: TemporalConfig): string {
  const lines: string[] = [
    `LET vestStart = STATE(${config.startPort})`,
    `LET cliffBlock = STATE(${config.cliffPort!})`,
    `LET total = STATE(${config.totalPort!})`,
    `LET prevClaimed = PREVSTATE(${config.beneficiaryPort!})`,
    `ASSERT @BLOCK GT cliffBlock`,
    `LET fullElapsed = SUB(@BLOCK vestStart)`,
    `LET cliffElapsed = SUB(@BLOCK cliffBlock)`,
    `LET vested = SUB(DIV(MUL(total fullElapsed) total) DIV(MUL(total cliffElapsed) total))`,
    `LET claimable = SUB(vested prevClaimed)`,
    `ASSERT claimable GT 0`,
    `ASSERT SIGNEDBY(0x${config.beneficiary!})`,
    `ASSERT VERIFYOUT(@INPUT 0x${config.beneficiary!} claimable @TOKENID TRUE)`,
    `STORE STATE(${config.beneficiaryPort!}, ADD(prevClaimed claimable))`,
  ]
  return lines.join('\n')
}

export function buildDeadlineScript(config: TemporalConfig): string {
  const lines: string[] = [
    `ASSERT @BLOCK LT ${config.deadlineBlock!.toString()}`,
    `ASSERT SIGNEDBY(0x${config.beneficiary!})`,
  ]
  return lines.join('\n')
}

export function buildWindowScript(config: TemporalConfig): string {
  const lines: string[] = [
    `ASSERT @BLOCK GTE ${config.windowStartBlock!.toString()}`,
    `ASSERT @BLOCK LTE ${config.windowEndBlock!.toString()}`,
  ]
  return lines.join('\n')
}

export function buildRateLimitScript(config: TemporalConfig): string {
  const lines: string[] = [
    `LET maxUsed = ${config.maxPerPeriod!.toString()}`,
    `LET used = PREVSTATE(${config.beneficiaryPort!})`,
    `ASSERT used LT maxUsed`,
    `STORE STATE(${config.beneficiaryPort!}, INC(used))`,
  ]
  return lines.join('\n')
}

export function buildDecayScript(config: TemporalConfig): string {
  const lines: string[] = [
    `LET vestStart = STATE(${config.startPort})`,
    `LET total = STATE(${config.totalPort!})`,
    `LET k = ${config.decayConstant!.toString()}`,
    `LET elapsed = SUB(@BLOCK vestStart)`,
    `LET numerator = @MAX_DECIMAL`,
    `LET denominator = ADD(@MAX_DECIMAL MUL(k elapsed))`,
    `LET value = DIV(MUL(total numerator) denominator)`,
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
      const total = state.get(config.totalPort!)!
      const prevClaimed = state.get(config.beneficiaryPort!) ?? 0n
      if (block <= vestStart) return 0n
      const elapsed = block - vestStart
      const vested = total * elapsed / total
      const claimable = vested - prevClaimed
      return claimable > 0n ? claimable : 0n
    }
    case 'cliff': {
      const vestStart = state.get(config.startPort)!
      const cliffBlock = state.get(config.cliffPort!)!
      const total = state.get(config.totalPort!)!
      const prevClaimed = state.get(config.beneficiaryPort!) ?? 0n
      if (block <= cliffBlock) return 0n
      const fullElapsed = block - vestStart
      const cliffElapsed = block - cliffBlock
      const vested1 = total * fullElapsed / total
      const vested2 = total * cliffElapsed / total
      const vested = vested1 - vested2
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
