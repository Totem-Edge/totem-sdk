/**
 * RFC-018 P1-6: experimental economics — counter advancement, vesting clamps,
 * delegate continuity, and required operator authorization.
 */
import { evaluateScript } from '../index';
import type { ScriptWitness, TxContext, CoinData, OutputData } from '../index';
import { buildTimeLockedReserveScript } from '../templates/treasury';
import { buildBudgetAllocationScript } from '../templates/treasury';
import { buildStreamingPaymentScript } from '../templates/treasury';
import { buildLiquidDemocracyScript } from '../templates/voting';
import { buildStateMachineScript } from '../templates/state-machine';

const pkAA = 'aa'.repeat(32);
const pkBB = 'bb'.repeat(32);

function mockSig(label: string): Uint8Array {
  const out = new Uint8Array(1088);
  for (let i = 0; i < 1088; i++) out[i] = label.charCodeAt(i % label.length) & 0xff;
  return out;
}

function coin(amount = 100): CoinData {
  return { amount, tokenId: '0x00', coinId: '0xabc', address: '0xAA' };
}

function outputTo(addr: string, amt: number, keepState = false): OutputData {
  return { address: addr, amount: amt, tokenId: '0x00', keepState };
}

function s(entries: Record<number, string | number>): Record<number, string> {
  const out: Record<number, string> = {};
  for (const [k, v] of Object.entries(entries)) out[Number(k)] = String(v);
  return out;
}

function ctx(overrides: Partial<TxContext> = {}): TxContext {
  return {
    block: 1000,
    inputIndex: 0,
    inputs: [coin()],
    outputs: [outputTo('0xAA', 100, true)],
    state: {},
    prevState: {},
    simulationMode: true,
    ...overrides,
  };
}

function run(script: string, tx: TxContext, sigs: Record<string, string> = {}) {
  const witness: ScriptWitness = {
    signatures: new Map(Object.entries(sigs).map(([pk, label]) => [pk, mockSig(label)])),
  };
  return evaluateScript(script, witness, tx);
}

describe('RFC-018 P1-6: treasury counters and clamps', () => {
  it('time-locked reserve clamps vesting to the total and advances the claim', () => {
    const script = buildTimeLockedReserveScript(pkAA, {
      reserveId: 'r1',
      totalReserve: '1000',
      cliffBlocks: 0,
      vestingBlocks: 10,
      beneficiaryPkd: pkBB,
      reservePort: 1,
      claimedPort: 2,
    }).script;
    // elapsed = 100 >> vestingBlocks; vested must clamp to 1000.
    const ok = run(script, ctx({
      block: 100,
      inputs: [coin(1000)],
      state: s({ 1: 0, 2: 1000 }),
      prevState: s({ 1: 0, 2: 0 }),
      outputs: [outputTo('0x' + pkBB, 1000, true)],
    }), { [pkAA]: 'governance' });
    expect(ok.success).toBe(true);

    // Claiming beyond the remaining reserve fails.
    const over = run(script, ctx({
      block: 100,
      inputs: [coin(2000)],
      state: s({ 1: 0, 2: 2000 }),
      prevState: s({ 1: 0, 2: 0 }),
      outputs: [outputTo('0x' + pkBB, 2000, true)],
    }), { [pkAA]: 'governance' });
    expect(over.success).toBe(false);
  });

  it('budget allocation advances the category counter', () => {
    const script = buildBudgetAllocationScript(pkAA, {
      budgetId: 'b1',
      fiscalPeriodBlocks: 100,
      categories: [{ name: 'ops', cap: '100', spentPort: 3 }],
      periodStartPort: 4,
    }).script;
    const ok = run(script, ctx({
      block: 50,
      inputs: [coin(50)],
      state: s({ 3: 50, 4: 0 }),
      prevState: s({ 3: 0, 4: 0 }),
      outputs: [outputTo('0xAA', 50, true)],
    }), { [pkAA]: 'finance' });
    expect(ok.success).toBe(true);

    const notAdvanced = run(script, ctx({
      block: 50,
      inputs: [coin(50)],
      state: s({ 3: 0, 4: 0 }),
      prevState: s({ 3: 0, 4: 0 }),
      outputs: [outputTo('0xAA', 50, true)],
    }), { [pkAA]: 'finance' });
    expect(notAdvanced.success).toBe(false);
  });

  it('streaming payment advances the streamed counter', () => {
    const script = buildStreamingPaymentScript(pkAA, {
      streamId: 's1',
      payeePkd: pkBB,
      ratePerBlock: '1',
      startBlock: 0,
      cancellationPort: 1,
      totalStreamedPort: 2,
    }).script;
    const ok = run(script, ctx({
      block: 100,
      inputs: [coin(50)],
      state: s({ 1: 0, 2: 50 }),
      prevState: s({ 1: 0, 2: 0 }),
      outputs: [outputTo('0x' + pkBB, 50, true)],
    }), { [pkAA]: 'payer' });
    expect(ok.success).toBe(true);

    const notAdvanced = run(script, ctx({
      block: 100,
      inputs: [coin(50)],
      state: s({ 1: 0, 2: 0 }),
      prevState: s({ 1: 0, 2: 0 }),
      outputs: [outputTo('0x' + pkBB, 50, true)],
    }), { [pkAA]: 'payer' });
    expect(notAdvanced.success).toBe(false);
  });
});

describe('RFC-018 P1-6: liquid democracy delegate continuity', () => {
  const script = () => buildLiquidDemocracyScript(pkAA, {
    proposalId: 'p1',
    delegationPort: 1,
    directVotePort: 2,
    delegationChainMaxDepth: 3,
    votingStartBlock: 0,
    votingEndBlock: 2000,
    recallPort: 3,
  }).script;

  it('accepts a committed delegated vote', () => {
    const ok = run(script(), ctx({
      block: 1000,
      state: s({ 1: '0x' + pkBB, 2: 0, 3: 0 }),
      prevState: s({ 1: '0x' + pkBB, 2: 0, 3: 0 }),
    }), { [pkAA]: 'gov', [pkBB]: 'delegate' });
    expect(ok.success).toBe(true);
  });

  it('rejects swapping the delegate in the executing transaction', () => {
    const swapped = run(script(), ctx({
      block: 1000,
      state: s({ 1: '0x' + pkAA, 2: 0, 3: 0 }),
      prevState: s({ 1: '0x' + pkBB, 2: 0, 3: 0 }),
    }), { [pkAA]: 'gov' });
    expect(swapped.success).toBe(false);
  });
});

describe('RFC-018 P1-6: state machine operator is required', () => {
  it('refuses to build an unauthorized state machine', () => {
    expect(() =>
      buildStateMachineScript({
        id: 'x',
        name: 'X',
        statePort: 1,
        states: ['A', 'B'],
        transitions: { A: ['B'] },
        initialState: 'A',
      }),
    ).toThrow(/operatorPkd/);
  });

  it('builds an authorized state machine', () => {
    const script = buildStateMachineScript({
      id: 'x',
      name: 'X',
      statePort: 1,
      states: ['A', 'B'],
      transitions: { A: ['B'] },
      initialState: 'A',
      operatorPkd: pkAA,
    });
    const ok = run(script, ctx({
      block: 1000,
      state: s({ 1: 'B' }),
      prevState: s({ 1: 'A' }),
    }), { [pkAA]: 'operator' });
    expect(ok.success).toBe(true);
  });
});
