import { evaluateScript } from '../index'
import type { ScriptWitness, TxContext, CoinData, OutputData } from '../index'
import {
  buildProposalStateMachineScript,
  buildVoteTallyScript,
  buildVoteSubmissionScript,
  buildExecutionMandateScript,
  buildTreasuryExecutionScript,
  STATUS,
} from '../templates/governance'
import type {
  ProposalConfig,
  VoteTallyConfig,
  VoteSubmissionConfig,
  ExecutionMandateConfig,
  TreasuryExecutionConfig,
} from '../templates/governance'

function mockSig(label: string): Uint8Array {
  const s = new Uint8Array(1088)
  for (let i = 0; i < 1088; i++) s[i] = label.charCodeAt(i % label.length) & 0xff
  return s
}

const pkAA = 'aa'.repeat(32)
const pkBB = 'bb'.repeat(32)
const pkCC = 'cc'.repeat(32)

const coin100: CoinData = { amount: 100, tokenId: '0x00', coinId: '0xabc', address: '0xAA' }

function outputTo(addr: string, amt: number, keepState = false): OutputData {
  return { address: addr, amount: amt, tokenId: '0x00', keepState }
}

function ctx(overrides: Partial<TxContext> = {}): TxContext {
  return {
    block: 1000,
    inputIndex: 0,
    inputs: [coin100],
    outputs: [outputTo('0xAA', 100, true)],
    state: {},
    prevState: {},
    simulationMode: true,
    ...overrides,
  }
}

function sigs(map: Record<string, string>): Record<string, string> {
  return map
}

function s(entries: Record<number, string | number>): Record<number, string> {
  const r: Record<number, string> = {}
  for (const [k, v] of Object.entries(entries)) {
    r[Number(k)] = typeof v === 'number' ? `0x${v.toString(16)}` : v
  }
  return r
}

function ps(entries: Record<number, string | number>): Record<number, string> {
  return s(entries)
}

describe('buildProposalStateMachineScript', () => {
  const cfg: ProposalConfig = {
    governancePks: [pkAA, pkBB],
    multisigThreshold: 2,
    executionDelayBlocks: BigInt(10),
  }

  // Helper: build a context with given prev/current status and optional block
  function mkCtx(prevStatus: number, currStatus: number, block = 1000): TxContext {
    return ctx({
      block,
      prevState: s({ 0: prevStatus, 1: 500, 2: 900, 3: 10 }),
      state: s({ 0: currStatus, 1: 500, 2: 900, 3: 10, 4: pkBB }),
    })
  }

  test('draft→active passes when block >= votingStartsAt', () => {
    const script = buildProposalStateMachineScript(cfg)
    const result = evaluateScript(script, { signatures: new Map() }, mkCtx(STATUS.DRAFT, STATUS.ACTIVE, 500))
    expect(result.success).toBe(true)
  })

  test('draft→active fails when block < votingStartsAt', () => {
    const script = buildProposalStateMachineScript(cfg)
    const result = evaluateScript(script, { signatures: new Map() }, mkCtx(STATUS.DRAFT, STATUS.ACTIVE, 499))
    expect(result.success).toBe(false)
  })

  test('draft→cancelled passes when signed by governance or proposer', () => {
    const script = buildProposalStateMachineScript(cfg)
    const result = evaluateScript(script, { signatures: new Map([[`${pkBB}aa`, mockSig('sig')]]) }, mkCtx(STATUS.DRAFT, STATUS.CANCELLED, 500))
    expect(result.success).toBe(true)
  })

  test('draft→cancelled fails without signature', () => {
    const script = buildProposalStateMachineScript(cfg)
    const result = evaluateScript(script, { signatures: new Map() }, mkCtx(STATUS.DRAFT, STATUS.CANCELLED, 500))
    expect(result.success).toBe(false)
  })

  test('active→passed passes with governance sig and block >= votingEndsAt', () => {
    const script = buildProposalStateMachineScript(cfg)
    const result = evaluateScript(script, { signatures: new Map([[pkAA, mockSig('sig')]]) }, mkCtx(STATUS.ACTIVE, STATUS.PASSED, 900))
    expect(result.success).toBe(true)
  })

  test('active→passed fails without governance sig', () => {
    const script = buildProposalStateMachineScript(cfg)
    const result = evaluateScript(script, { signatures: new Map() }, mkCtx(STATUS.ACTIVE, STATUS.PASSED, 900))
    expect(result.success).toBe(false)
  })

  test('active→failed passes with governance sig and block >= votingEndsAt', () => {
    const script = buildProposalStateMachineScript(cfg)
    const result = evaluateScript(script, { signatures: new Map([[pkAA, mockSig('sig')]]) }, mkCtx(STATUS.ACTIVE, STATUS.FAILED, 900))
    expect(result.success).toBe(true)
  })

  test('active→expired passes when block > votingEndsAt', () => {
    const script = buildProposalStateMachineScript(cfg)
    const result = evaluateScript(script, { signatures: new Map() }, mkCtx(STATUS.ACTIVE, STATUS.EXPIRED, 901))
    expect(result.success).toBe(true)
  })

  test('active→expired fails when block <= votingEndsAt', () => {
    const script = buildProposalStateMachineScript(cfg)
    const result = evaluateScript(script, { signatures: new Map() }, mkCtx(STATUS.ACTIVE, STATUS.EXPIRED, 900))
    expect(result.success).toBe(false)
  })

  test('passed→executed requires multisig 2/2 and block > votingEndsAt + executionDelay', () => {
    const script = buildProposalStateMachineScript(cfg)
    const result = evaluateScript(script, { signatures: new Map([[pkAA, mockSig('s1')], [pkBB, mockSig('s2')]]) }, mkCtx(STATUS.PASSED, STATUS.EXECUTED, 911))
    expect(result.success).toBe(true)
  })

  test('passed→executed fails when block <= votingEndsAt + executionDelay', () => {
    const script = buildProposalStateMachineScript(cfg)
    const result = evaluateScript(script, { signatures: new Map([[pkAA, mockSig('s1')], [pkBB, mockSig('s2')]]) }, mkCtx(STATUS.PASSED, STATUS.EXECUTED, 910))
    expect(result.success).toBe(false)
  })

  test('passed→executed fails without enough multisig', () => {
    const script = buildProposalStateMachineScript(cfg)
    const result = evaluateScript(script, { signatures: new Map([[pkAA, mockSig('s1')]]) }, mkCtx(STATUS.PASSED, STATUS.EXECUTED, 911))
    expect(result.success).toBe(false)
  })

  test('passed→cancelled passes with governance sig', () => {
    const script = buildProposalStateMachineScript(cfg)
    const result = evaluateScript(script, { signatures: new Map([[pkAA, mockSig('sig')]]) }, mkCtx(STATUS.PASSED, STATUS.CANCELLED, 1000))
    expect(result.success).toBe(true)
  })

  test('failed→cancelled passes (no sig required)', () => {
    const script = buildProposalStateMachineScript(cfg)
    const result = evaluateScript(script, { signatures: new Map() }, mkCtx(STATUS.FAILED, STATUS.CANCELLED, 1000))
    expect(result.success).toBe(true)
  })

  test('failed→executed fails (invalid transition)', () => {
    const script = buildProposalStateMachineScript(cfg)
    const result = evaluateScript(script, { signatures: new Map() }, mkCtx(STATUS.FAILED, STATUS.EXECUTED, 1000))
    expect(result.success).toBe(false)
  })

  test('draft→passed fails (invalid transition)', () => {
    const script = buildProposalStateMachineScript(cfg)
    const result = evaluateScript(script, { signatures: new Map() }, mkCtx(STATUS.DRAFT, STATUS.PASSED, 1000))
    expect(result.success).toBe(false)
  })

  test('executed→anything fails (terminal)', () => {
    const script = buildProposalStateMachineScript(cfg)
    const result = evaluateScript(script, { signatures: new Map() }, mkCtx(STATUS.EXECUTED, STATUS.ACTIVE, 1000))
    expect(result.success).toBe(false)
  })

  test('cancelled→anything fails (terminal)', () => {
    const script = buildProposalStateMachineScript(cfg)
    const result = evaluateScript(script, { signatures: new Map() }, mkCtx(STATUS.CANCELLED, STATUS.ACTIVE, 1000))
    expect(result.success).toBe(false)
  })

  test('expired→anything fails (terminal)', () => {
    const script = buildProposalStateMachineScript(cfg)
    const result = evaluateScript(script, { signatures: new Map() }, mkCtx(STATUS.EXPIRED, STATUS.ACTIVE, 1000))
    expect(result.success).toBe(false)
  })
})

describe('buildVoteTallyScript', () => {
  const cfg: VoteTallyConfig = {
    quorumPct: 51,
    minVoteBlocks: BigInt(0),
    governancePk: pkAA,
  }

  function mkCtx(prev: { yes: number; no: number; abstain: number; total: number }, curr: { yes: number; no: number; abstain: number; total: number }, block = 700, gSigs?: Record<string, string>): TxContext {
    return ctx({
      block,
      prevState: s({ 0: prev.yes, 1: prev.no, 2: prev.abstain, 3: prev.total }),
      state: s({ 0: curr.yes, 1: curr.no, 2: curr.abstain, 3: curr.total }),
      signatures: new Map(Object.entries(gSigs ?? { [pkAA]: 'sig' }).map(([k, v]) => [k, mockSig(v)])),
    })
  }

  test('passes for valid vote tally with quorum reached', () => {
    const script = buildVoteTallyScript(cfg)
    const result = evaluateScript(script, {}, mkCtx({ yes: 0, no: 0, abstain: 0, total: 0 }, { yes: 30, no: 20, abstain: 5, total: 55 }))
    expect(result.success).toBe(true)
  })

  test('fails when quorum not reached', () => {
    const script = buildVoteTallyScript(cfg)
    const result = evaluateScript(script, {}, mkCtx({ yes: 0, no: 0, abstain: 0, total: 0 }, { yes: 30, no: 20, abstain: 0, total: 50 }))
    expect(result.success).toBe(false)
  })

  test('fails when total delta does not match sum of choice deltas', () => {
    const script = buildVoteTallyScript(cfg)
    const result = evaluateScript(script, {}, mkCtx({ yes: 0, no: 0, abstain: 0, total: 0 }, { yes: 30, no: 20, abstain: 5, total: 50 }))
    expect(result.success).toBe(false)
  })

  test('fails when no votes cast (totalDelta = 0)', () => {
    const script = buildVoteTallyScript(cfg)
    const result = evaluateScript(script, {}, mkCtx({ yes: 10, no: 5, abstain: 0, total: 15 }, { yes: 10, no: 5, abstain: 0, total: 15 }))
    expect(result.success).toBe(false)
  })

  test('fails without governance signature', () => {
    const script = buildVoteTallyScript(cfg)
    const result = evaluateScript(script, {}, mkCtx({ yes: 0, no: 0, abstain: 0, total: 0 }, { yes: 30, no: 20, abstain: 5, total: 55 }, 700, {}))
    expect(result.success).toBe(false)
  })

  test('passes with only yes votes (no=0)', () => {
    const script = buildVoteTallyScript(cfg)
    const result = evaluateScript(script, {}, mkCtx({ yes: 0, no: 0, abstain: 0, total: 0 }, { yes: 60, no: 0, abstain: 0, total: 60 }))
    expect(result.success).toBe(true)
  })
})

describe('buildVoteSubmissionScript', () => {
  const cfg: VoteSubmissionConfig = {
    governancePk: pkAA,
    quorumBps: BigInt(5100),
    noncePort: 1,
    weightPort: 2,
    snapshotPort: 5,
  }

  const snapshotHash = '0x' + 'ef'.repeat(32)

  function mkCtx(voterPk: string, nonce: number, prevNonce: number, weight: number, choice: number, block = 700, gSigs?: Record<string, string>): TxContext {
    return ctx({
      block,
      prevState: s({ 1: prevNonce }),
      state: s({ 0: voterPk, 1: nonce, 2: weight, 3: choice, 4: weight, 5: snapshotHash }),
      signatures: new Map(Object.entries(gSigs ?? { [pkAA]: 'sig' }).map(([k, v]) => [k, mockSig(v)])),
    })
  }

  test('passes for valid vote submission', () => {
    const script = buildVoteSubmissionScript(cfg)
    const result = evaluateScript(script, {}, mkCtx(pkBB, 2, 1, 10, 0))
    expect(result.success).toBe(true)
  })

  test('fails when nonce not incremented', () => {
    const script = buildVoteSubmissionScript(cfg)
    const result = evaluateScript(script, {}, mkCtx(pkBB, 1, 1, 10, 0))
    expect(result.success).toBe(false)
  })

  test('fails when nonce decreases', () => {
    const script = buildVoteSubmissionScript(cfg)
    const result = evaluateScript(script, {}, mkCtx(pkBB, 0, 1, 10, 0))
    expect(result.success).toBe(false)
  })

  test('fails when weight is zero', () => {
    const script = buildVoteSubmissionScript(cfg)
    const result = evaluateScript(script, {}, mkCtx(pkBB, 2, 1, 0, 0))
    expect(result.success).toBe(false)
  })

  test('fails when choice is out of range (< 0)', () => {
    const script = buildVoteSubmissionScript(cfg)
    const result = evaluateScript(script, {}, mkCtx(pkBB, 2, 1, 10, -1))
    expect(result.success).toBe(false)
  })

  test('fails when choice is out of range (> 2)', () => {
    const script = buildVoteSubmissionScript(cfg)
    const result = evaluateScript(script, {}, mkCtx(pkBB, 2, 1, 10, 3))
    expect(result.success).toBe(false)
  })

  test('passes for abstain choice (2)', () => {
    const script = buildVoteSubmissionScript(cfg)
    const result = evaluateScript(script, {}, mkCtx(pkBB, 2, 1, 10, 2))
    expect(result.success).toBe(true)
  })

  test('fails without governance signature', () => {
    const script = buildVoteSubmissionScript(cfg)
    const result = evaluateScript(script, {}, mkCtx(pkBB, 2, 1, 10, 0, 700, {}))
    expect(result.success).toBe(false)
  })
})

describe('buildExecutionMandateScript', () => {
  const cfg: ExecutionMandateConfig = {
    governancePks: [pkAA, pkBB],
    multisigThreshold: 2,
    executionDelayBlocks: BigInt(10),
    outcomeProofPort: 1,
    tallyHashPort: 2,
    snapshotPort: 3,
  }

  const outcomeProof = '0x' + 'aa'.repeat(32)
  const tallyHash = '0x' + 'bb'.repeat(32)
  const snapHash = '0x' + 'cc'.repeat(32)

  function mkCtx(nonce: number, prevNonce: number, block = 1000, mSigs?: Record<string, string>): TxContext {
    return ctx({
      block,
      prevState: s({ 0: prevNonce }),
      state: s({ 0: nonce, 1: outcomeProof, 2: tallyHash, 3: snapHash, 4: 900, 5: 10 }),
      signatures: new Map(Object.entries(mSigs ?? { [pkAA]: 's1', [pkBB]: 's2' }).map(([k, v]) => [k, mockSig(v)])),
    })
  }

  test('passes when all conditions met with multisig 2/2', () => {
    const script = buildExecutionMandateScript(cfg)
    const result = evaluateScript(script, {}, mkCtx(1, 0, 911))
    expect(result.success).toBe(true)
  })

  test('fails when timelock not reached (block <= votingEndsAt + delay)', () => {
    const script = buildExecutionMandateScript(cfg)
    const result = evaluateScript(script, {}, mkCtx(1, 0, 910))
    expect(result.success).toBe(false)
  })

  test('fails without multisig', () => {
    const script = buildExecutionMandateScript(cfg)
    const result = evaluateScript(script, {}, mkCtx(1, 0, 911, {}))
    expect(result.success).toBe(false)
  })

  test('fails with only 1 of 2 multisig', () => {
    const script = buildExecutionMandateScript(cfg)
    const result = evaluateScript(script, {}, mkCtx(1, 0, 911, { [pkAA]: 's1' }))
    expect(result.success).toBe(false)
  })

  test('fails when nonce not incremented (replay)', () => {
    const script = buildExecutionMandateScript(cfg)
    const result = evaluateScript(script, {}, mkCtx(0, 0, 911))
    expect(result.success).toBe(false)
  })

  test('fails when outcomeProof is empty', () => {
    const script = buildExecutionMandateScript(cfg)
    const result = evaluateScript(script, {}, ctx({
      block: 911,
      prevState: s({ 0: 0 }),
      state: s({ 0: 1, 1: '0x00', 2: tallyHash, 3: snapHash, 4: 900, 5: 10 }),
      signatures: new Map([[pkAA, mockSig('s1')], [pkBB, mockSig('s2')]]),
    }))
    expect(result.success).toBe(false)
  })

  test('fails when tallyHash is empty', () => {
    const script = buildExecutionMandateScript(cfg)
    const result = evaluateScript(script, {}, ctx({
      block: 911,
      prevState: s({ 0: 0 }),
      state: s({ 0: 1, 1: outcomeProof, 2: '0x00', 3: snapHash, 4: 900, 5: 10 }),
      signatures: new Map([[pkAA, mockSig('s1')], [pkBB, mockSig('s2')]]),
    }))
    expect(result.success).toBe(false)
  })
})

describe('buildTreasuryExecutionScript', () => {
  const cfg: TreasuryExecutionConfig = {
    treasuryPk: pkAA,
    governancePks: [pkAA, pkBB],
    multisigThreshold: 2,
    recipientPk: pkCC,
    amount: '0x64',
    tokenId: '0x00',
  }

  function mkCtx(block = 1000, nonce = 1, prevNonce = 0, mSigs?: Record<string, string>): TxContext {
    return ctx({
      block,
      prevState: s({ 4: prevNonce }),
      state: s({ 0: 900, 1: '0x' + 'dd'.repeat(32), 2: 0, 3: '0x01', 4: nonce }),
      inputs: [coin100],
      outputs: [outputTo(`0x${pkCC}`, 100, false)],
      signatures: new Map(Object.entries(mSigs ?? { [pkAA]: 's1', [pkBB]: 's2' }).map(([k, v]) => [k, mockSig(v)])),
    })
  }

  test('passes when all conditions met', () => {
    const script = buildTreasuryExecutionScript(cfg)
    const result = evaluateScript(script, {}, mkCtx(901))
    expect(result.success).toBe(true)
  })

  test('fails when block <= timelock', () => {
    const script = buildTreasuryExecutionScript(cfg)
    const result = evaluateScript(script, {}, mkCtx(900))
    expect(result.success).toBe(false)
  })

  test('fails without multisig', () => {
    const script = buildTreasuryExecutionScript(cfg)
    const result = evaluateScript(script, {}, mkCtx(901, 1, 0, {}))
    expect(result.success).toBe(false)
  })

  test('fails when nonce is same as prev (replay)', () => {
    const script = buildTreasuryExecutionScript(cfg)
    const result = evaluateScript(script, {}, mkCtx(901, 0, 0))
    expect(result.success).toBe(false)
  })
})
