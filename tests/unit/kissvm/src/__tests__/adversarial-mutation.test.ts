/**
 * RFC-016 §7 / RFC-018 P2-5: adversarial mutation harness.
 *
 * For each authorizing template: the honest transaction must evaluate true, and
 * every security-relevant mutation (wrong signer, missing signature, rewritten
 * committed state, redirected output, replayed/reused state) must evaluate
 * false. This is a single matrix so a regression in any template is caught by
 * the same harness.
 */
import { evaluateScript } from '../index';
import type { ScriptWitness, TxContext, CoinData, OutputData } from '../index';
import { buildStatechainScript } from '../templates/statechain';
import { buildPaymentIntentScript } from '../templates/agent-policy';
import { buildActionAuthorizationScript } from '../templates/authority';
import { buildMultiSigTreasuryScript } from '../templates/treasury';
import { buildEscrowEnforcementScript } from '../templates/industrial-action';
import { buildCapabilityScript } from '../templates/manifest';

const pkAA = 'aa'.repeat(32);
const pkBB = 'bb'.repeat(32);
const pkCC = 'cc'.repeat(32);
const hx = (s: string) => Buffer.from(s, 'utf8').toString('hex');

function mockSig(label: string): Uint8Array {
  const out = new Uint8Array(1088);
  for (let i = 0; i < 1088; i++) out[i] = label.charCodeAt(i % label.length) & 0xff;
  return out;
}
function coin(amount = 100, created?: number): CoinData {
  return { amount, tokenId: '0x00', coinId: '0xabc', address: '0xAA', coinCreatedBlock: created };
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

interface Mutation {
  name: string;
  apply: (base: { ctx: TxContext; sigs: Record<string, string> }) => {
    ctx?: TxContext;
    sigs?: Record<string, string>;
  };
}
interface Case {
  name: string;
  script: () => string;
  base: { ctx: TxContext; sigs: Record<string, string> };
  mutations: Mutation[];
}

const cases: Case[] = [
  {
    name: 'statechain (owner+SE multisig)',
    script: () => buildStatechainScript({ sePk: pkBB, reclaimTimelock: 256n }),
    base: {
      ctx: ctx({ inputs: [coin(100, 900)], state: s({ 0: pkAA }), prevState: s({ 0: pkAA }) }),
      sigs: { [pkAA]: 'owner', [pkBB]: 'se' },
    },
    mutations: [
      { name: 'SE alone', apply: () => ({ sigs: { [pkBB]: 'se' } }) },
      { name: 'owner alone', apply: () => ({ sigs: { [pkAA]: 'owner' } }) },
      {
        name: 'substitute SE into the owner position',
        apply: () => ({ ctx: ctx({ inputs: [coin(100, 900)], state: s({ 0: pkBB }), prevState: s({ 0: pkAA }) }), sigs: { [pkBB]: 'se' } }),
      },
    ],
  },
  {
    name: 'payment intent (authority + output binding)',
    script: () => buildPaymentIntentScript({ authorityPk: pkAA, riskLimit: '100', allowedRecipient: pkBB, expiresAt: 2000n }),
    base: {
      ctx: ctx({ state: s({ 20: 50, 21: '0x' + pkBB }), prevState: s({ 20: 50, 21: '0x' + pkBB }), outputs: [outputTo('0x' + pkBB, 50, true)] }),
      sigs: { [pkAA]: 'authority' },
    },
    mutations: [
      { name: 'wrong signer', apply: () => ({ sigs: { [pkCC]: 'attacker' } }) },
      { name: 'no signer', apply: () => ({ sigs: {} }) },
      { name: 'over risk limit', apply: () => ({ ctx: ctx({ state: s({ 20: 150, 21: '0x' + pkBB }), prevState: s({ 20: 150, 21: '0x' + pkBB }), outputs: [outputTo('0x' + pkBB, 150, true)] }) }) },
      { name: 'redirect the output', apply: () => ({ ctx: ctx({ state: s({ 20: 50, 21: '0x' + pkBB }), prevState: s({ 20: 50, 21: '0x' + pkBB }), outputs: [outputTo('0x' + pkCC, 50, true)] }) }) },
    ],
  },
  {
    name: 'action authorization (fixed authority + monotonic nonce)',
    script: () => buildActionAuthorizationScript({ authorityPk: pkAA, actionHash: 'ab'.repeat(32), windowEnd: 1500n, noncePort: 5, actionPort: 6, windowEndPort: 7 }),
    base: {
      ctx: ctx({ block: 1000, state: s({ 5: 2, 6: '0x' + 'ab'.repeat(32) }), prevState: s({ 5: 1 }) }),
      sigs: { [pkAA]: 'authority' },
    },
    mutations: [
      { name: 'missing authority', apply: () => ({ sigs: {} }) },
      { name: 'non-monotonic nonce', apply: () => ({ ctx: ctx({ block: 1000, state: s({ 5: 1, 6: '0x' + 'ab'.repeat(32) }), prevState: s({ 5: 1 }) }) }) },
      { name: 'wrong action hash', apply: () => ({ ctx: ctx({ block: 1000, state: s({ 5: 2, 6: '0x' + 'cd'.repeat(32) }), prevState: s({ 5: 1 }) }) }) },
    ],
  },
  {
    name: 'multi-sig treasury (threshold + period cap)',
    script: () => buildMultiSigTreasuryScript([pkAA, pkBB], 2, { treasuryId: 't', maxSpendPerPeriod: '100', periodBlocks: 10, periodStartPort: 1, spentThisPeriodPort: 2, recipientPkd: pkCC }).script,
    base: {
      ctx: ctx({ block: 1000, inputs: [coin(50)], state: s({ 1: 1000, 2: 50 }), prevState: s({ 1: 1000, 2: 0 }), outputs: [outputTo('0x' + pkCC, 50, true)] }),
      sigs: { [pkAA]: 'a', [pkBB]: 'b' },
    },
    mutations: [
      { name: 'below threshold', apply: () => ({ sigs: { [pkAA]: 'a' } }) },
      { name: 'over period cap', apply: () => ({ ctx: ctx({ block: 1000, inputs: [coin(150)], state: s({ 1: 1000, 2: 150 }), prevState: s({ 1: 1000, 2: 0 }), outputs: [outputTo('0x' + pkCC, 150, true)] }) }) },
      { name: 'redirect the payment', apply: () => ({ ctx: ctx({ block: 1000, inputs: [coin(50)], state: s({ 1: 1000, 2: 50 }), prevState: s({ 1: 1000, 2: 0 }), outputs: [outputTo('0x' + pkAA, 50, true)] }) }) },
    ],
  },
  {
    name: 'escrow (authority + beneficiary payout)',
    script: () => buildEscrowEnforcementScript({ conditionHash: 'ab'.repeat(32), amount: '100', conditionPort: 1, amountPort: 2, authorityPk: pkAA, beneficiaryPkd: pkBB }),
    base: {
      ctx: ctx({ state: s({ 1: '0x' + 'ab'.repeat(32), 2: 100 }), prevState: s({ 1: '0x' + 'ab'.repeat(32), 2: 100 }), outputs: [outputTo('0x' + pkBB, 100, true)] }),
      sigs: { [pkAA]: 'authority' },
    },
    mutations: [
      { name: 'missing authority', apply: () => ({ sigs: {} }) },
      { name: 'wrong amount', apply: () => ({ ctx: ctx({ state: s({ 1: '0x' + 'ab'.repeat(32), 2: 200 }), prevState: s({ 1: '0x' + 'ab'.repeat(32), 2: 200 }), outputs: [outputTo('0x' + pkBB, 100, true)] }) }) },
      { name: 'wrong beneficiary', apply: () => ({ ctx: ctx({ state: s({ 1: '0x' + 'ab'.repeat(32), 2: 100 }), prevState: s({ 1: '0x' + 'ab'.repeat(32), 2: 100 }), outputs: [outputTo('0x' + pkCC, 100, true)] }) }) },
    ],
  },
  {
    name: 'manifest capability (agent + permission + expiry)',
    script: () => buildCapabilityScript({ agentPk: pkAA, permissions: [hx('read')], expiresAt: 2000n }),
    base: {
      ctx: ctx({ block: 1000, state: s({ 0: '0x' + hx('read') }) }),
      sigs: { [pkAA]: 'agent' },
    },
    mutations: [
      { name: 'wrong agent', apply: () => ({ sigs: { [pkCC]: 'attacker' } }) },
      { name: 'unpermitted permission', apply: () => ({ ctx: ctx({ block: 1000, state: s({ 0: '0x' + hx('write') }) }) }) },
      { name: 'after expiry', apply: () => ({ ctx: ctx({ block: 3000, state: s({ 0: '0x' + hx('read') }) }) }) },
    ],
  },
];

describe('RFC-018 P2-5: adversarial mutation harness', () => {
  for (const testCase of cases) {
    it(`${testCase.name}: honest passes, every mutation fails`, () => {
      const script = testCase.script();
      const honest = run(script, testCase.base.ctx, testCase.base.sigs);
      expect(honest.success).toBe(true);

      for (const mutation of testCase.mutations) {
        const { ctx: mCtx, sigs } = mutation.apply(testCase.base);
        const result = run(script, mCtx ?? testCase.base.ctx, sigs ?? testCase.base.sigs);
        expect({ mutation: mutation.name, success: result.success }).toEqual({
          mutation: mutation.name,
          success: false,
        });
      }
    });
  }
});
