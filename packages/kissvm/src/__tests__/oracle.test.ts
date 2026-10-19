import { wotsAddressData } from '@totemsdk/core';
/**
 * OMP-18/19 oracle condition witness — template logic (RFC-048 §3.1).
 *
 * kissvm jest maps `@totemsdk/core` to a mock, so real WOTS verification is not
 * available here; these tests use `simulationMode` to exercise the *branch logic*
 * (quorum by key, freshness window, feed commitment, value condition). Real
 * signatures across both VMs are covered by `scripts/exercise-exec-vm.mjs`.
 */

import { evaluateScript } from '../index';
import type { ScriptWitness, TxContext } from '../index';
import { buildOracleConditionScript, oracleConditionStateVariables, buildOracleExerciseCovenant } from '../templates/oracle';

const pkORACLE_A = 'aa'.repeat(32);
const pkORACLE_B = 'bb'.repeat(32);
const pkBENEFICIARY = 'cc'.repeat(32);
const FEED = '0x' + 'fe'.repeat(32);

function s(entries: Record<number, string | number>): Record<number, string> {
  const r: Record<number, string> = {};
  for (const [k, v] of Object.entries(entries)) r[Number(k)] = String(v);
  return r;
}

function oracleCtx(opts: {
  block: number;
  value?: number;
  observed?: number;
  valid?: number;
  feed?: string;
  stateFeed?: string;
  to?: string;
}): TxContext {
  const value = opts.value ?? 1000;
  const observed = opts.observed ?? 500;
  const valid = opts.valid ?? 600;
  const feed = opts.feed ?? FEED;
  const stateFeed = opts.stateFeed ?? feed;
  const to = opts.to ?? '0x' + pkBENEFICIARY;
  return {
    block: opts.block,
    inputIndex: 0,
    inputs: [{ amount: 1000, tokenId: '0x00', coinId: '0xabc', address: '0x' + 'dd'.repeat(32) }],
    outputs: [{ address: wotsAddressData(to), amount: 1000, tokenId: '0x00', keepState: false }],
    state: s({ 120: value, 121: observed, 122: valid, 123: stateFeed }),
    prevState: s({ 120: value, 121: observed, 122: valid, 123: feed }),
    simulationMode: true,
  };
}

function run(script: string, tx: TxContext, signers: string[] = []) {
  const witness: ScriptWitness = { signatures: new Map(signers.map((pk) => [pk, new Uint8Array([1])])) };
  return evaluateScript(script, witness, tx);
}

const single = buildOracleConditionScript({
  oracles: [pkORACLE_A],
  comparison: { op: 'GTE', valueAtoms: 1000n },
  beneficiary: pkBENEFICIARY,
});
const quorum = buildOracleConditionScript({
  oracles: [pkORACLE_A, pkORACLE_B],
  threshold: 2,
  comparison: { op: 'GTE', valueAtoms: 1000n },
});

describe('OMP-18/19 oracle condition witness', () => {
  it('accepts a fresh observation satisfying the value condition', () => {
    expect(run(single, oracleCtx({ block: 550 }), [pkORACLE_A]).success).toBe(true);
  });

  it('fails closed when the oracle has not authorized', () => {
    expect(run(single, oracleCtx({ block: 550 }), []).success).toBe(false);
  });

  it('rejects a stale observation', () => {
    expect(run(single, oracleCtx({ block: 700 }), [pkORACLE_A]).success).toBe(false);
  });

  it('rejects an observation before its validity window', () => {
    expect(run(single, oracleCtx({ block: 400 }), [pkORACLE_A]).success).toBe(false);
  });

  it('rejects a value that does not satisfy the condition', () => {
    expect(run(single, oracleCtx({ block: 550, value: 999 }), [pkORACLE_A]).success).toBe(false);
  });

  it('rejects when the feed commitment is mutated', () => {
    expect(run(single, oracleCtx({ block: 550, stateFeed: '0x' + 'ab'.repeat(32) }), [pkORACLE_A]).success).toBe(false);
  });

  it('enforces the quorum threshold', () => {
    expect(run(quorum, oracleCtx({ block: 550 }), [pkORACLE_A, pkORACLE_B]).success).toBe(true);
    expect(run(quorum, oracleCtx({ block: 550 }), [pkORACLE_A]).success).toBe(false);
  });

  it('pays only the committed beneficiary', () => {
    const wrong = oracleCtx({ block: 550, to: '0x' + '99'.repeat(32) });
    expect(run(single, wrong, [pkORACLE_A]).success).toBe(false);
  });
});

describe('P-EXIT × OMP-19 non-cooperative oracle exercise', () => {
  const oex = buildOracleExerciseCovenant({
    beneficiary: pkBENEFICIARY,
    recovery: pkORACLE_A,
    comparison: { op: 'GTE', valueAtoms: 1000n },
  });
  function oexCtx(opts: { block: number; value?: number; observed?: number; valid?: number; to?: string }): TxContext {
    const value = opts.value ?? 1000;
    const observed = opts.observed ?? 500;
    const valid = opts.valid ?? 600;
    return {
      block: opts.block,
      inputIndex: 0,
      inputs: [{ amount: 1000, tokenId: '0x00', coinId: '0xabc', address: '0x' + 'dd'.repeat(32) }],
      outputs: [{ address: wotsAddressData(opts.to ?? '0x' + pkBENEFICIARY), amount: 1000, tokenId: '0x00', keepState: false }],
      state: s({ 100: 500, 101: 600, 120: value, 121: observed, 122: valid, 123: FEED }),
      prevState: s({ 100: 500, 101: 600, 120: value, 121: observed, 122: valid, 123: FEED }),
      simulationMode: true,
    };
  }

  it('beneficiary exercises alone when the committed observation is fresh and satisfies the condition', () => {
    expect(run(oex, oexCtx({ block: 550 }), [pkBENEFICIARY]).success).toBe(true);
  });

  it('rejects before maturity', () => {
    expect(run(oex, oexCtx({ block: 400 }), [pkBENEFICIARY]).success).toBe(false);
  });

  it('rejects a stale committed observation', () => {
    expect(run(oex, oexCtx({ block: 550, valid: 400 }), [pkBENEFICIARY]).success).toBe(false);
  });

  it('rejects when the value condition fails', () => {
    expect(run(oex, oexCtx({ block: 550, value: 999 }), [pkBENEFICIARY]).success).toBe(false);
  });

  it('the owner cannot exercise in-window', () => {
    expect(run(oex, oexCtx({ block: 550 }), [pkORACLE_A]).success).toBe(false);
  });

  it('the owner reclaims after recovery', () => {
    expect(run(oex, oexCtx({ block: 650, to: '0x' + pkORACLE_A }), []).success).toBe(true);
  });
});

describe('oracleConditionStateVariables', () => {
  it('commits value, freshness window and feed hash', () => {
    const vars = oracleConditionStateVariables({
      valueAtoms: 1000n,
      observedAtBlock: 500n,
      validUntilBlock: 600n,
      feedHash: 'fe'.repeat(32),
    });
    expect(vars).toEqual([
      { port: 120, value: 1000n, type: 'number' },
      { port: 121, value: 500n, type: 'number' },
      { port: 122, value: 600n, type: 'number' },
      { port: 123, value: FEED, type: 'hex' },
    ]);
  });

  it('rejects a validity window that does not advance', () => {
    expect(() =>
      oracleConditionStateVariables({ valueAtoms: 1n, observedAtBlock: 600n, validUntilBlock: 600n, feedHash: 'fe'.repeat(32) }),
    ).toThrow();
  });
});
