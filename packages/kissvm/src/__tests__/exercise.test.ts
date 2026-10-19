/**
 * P-EXIT exercise covenant — template logic (RFC-050 §3).
 *
 * kissvm jest maps `@totemsdk/core` to a mock, so real WOTS verification is not
 * available here; these tests use `simulationMode` to exercise the *script logic*
 * (which branch opens, by which key, at which block). Real-signature enforcement
 * across the TypeScript and Rust/WASM VMs is covered by
 * `scripts/exercise-exec-vm.mjs`.
 */

import { evaluateScript } from '../index';
import type { ScriptWitness, TxContext, CoinData, OutputData } from '../index';
import {
  buildExerciseCovenant,
  exerciseCovenantStateVariables,
} from '../templates/exercise';

const pkBENEFICIARY = 'aa'.repeat(32);
const pkOWNER = 'bb'.repeat(32);
const COVENANT = '0x' + 'dd'.repeat(32);

function s(entries: Record<number, string | number>): Record<number, string> {
  const r: Record<number, string> = {};
  for (const [k, v] of Object.entries(entries)) r[Number(k)] = String(v);
  return r;
}

function covCtx(block: number, to: string): TxContext {
  const inputs: CoinData[] = [{ amount: 100, tokenId: '0x00', coinId: '0xabc', address: COVENANT }];
  const outputs: OutputData[] = [{ address: to, amount: 100, tokenId: '0x00', keepState: false }];
  return {
    block,
    inputIndex: 0,
    inputs,
    outputs,
    state: s({ 100: 500, 101: 600 }),
    prevState: s({ 100: 500, 101: 600 }),
    simulationMode: true,
  };
}

function run(script: string, tx: TxContext, signers: string[] = []) {
  const witness: ScriptWitness = {
    signatures: new Map(signers.map((pk) => [pk, new Uint8Array([1])])),
  };
  return evaluateScript(script, witness, tx);
}

const covenant = buildExerciseCovenant({
  kind: 'unilateral-exercise',
  beneficiary: pkBENEFICIARY,
  recovery: pkOWNER,
});
const beneficiaryAddr = '0x' + pkBENEFICIARY;
const ownerAddr = '0x' + pkOWNER;

describe('P-EXIT exercise covenant', () => {
  it('beneficiary can exercise in [maturity, recovery)', () => {
    expect(run(covenant, covCtx(550, beneficiaryAddr), [pkBENEFICIARY]).success).toBe(true);
  });

  it('exercise is rejected before maturity', () => {
    expect(run(covenant, covCtx(400, beneficiaryAddr), [pkBENEFICIARY]).success).toBe(false);
  });

  it('the owner cannot exercise or redirect during the window', () => {
    // Owner signs, but SIGNEDBY(beneficiary) is not satisfied.
    expect(run(covenant, covCtx(550, beneficiaryAddr), [pkOWNER]).success).toBe(false);
  });

  it('exercise is rejected with no signature', () => {
    expect(run(covenant, covCtx(550, beneficiaryAddr), []).success).toBe(false);
  });

  it('exercise is closed once recovery opens', () => {
    expect(run(covenant, covCtx(600, beneficiaryAddr), [pkBENEFICIARY]).success).toBe(false);
  });

  it('owner can reclaim after recovery (no signature required)', () => {
    expect(run(covenant, covCtx(650, ownerAddr), []).success).toBe(true);
  });

  it('owner cannot reclaim before recovery', () => {
    expect(run(covenant, covCtx(550, ownerAddr), []).success).toBe(false);
  });

  it('permissionless condition variant pays the fixed beneficiary', () => {
    const liquidation = buildExerciseCovenant({
      kind: 'liquidation',
      beneficiary: pkBENEFICIARY,
      recovery: pkOWNER,
      condition: '@BLOCK GTE 500',
      requireSignature: false,
    });
    expect(run(liquidation, covCtx(550, beneficiaryAddr), []).success).toBe(true);
    expect(run(liquidation, covCtx(400, beneficiaryAddr), []).success).toBe(false);
    expect(run(liquidation, covCtx(550, ownerAddr), []).success).toBe(false);
  });

  it('emits the expected structural markers', () => {
    expect(covenant).toContain('SIGNEDBY(');
    expect(covenant).toContain(`SIGNEDBY(0x${pkBENEFICIARY})`);
    expect(covenant).toContain(`VERIFYOUT(0 0x${pkOWNER} @AMOUNT 0x00 FALSE)`);
    expect(covenant).toContain('ASSERT SAMESTATE(100 100)');
    expect(covenant).toContain('ASSERT SAMESTATE(101 101)');
  });
});

describe('P-EXIT partial payout + remainder', () => {
  const partial = buildExerciseCovenant({
    kind: 'unilateral-exercise',
    beneficiary: pkBENEFICIARY,
    recovery: pkOWNER,
    payout: 400n,
  });

  function outputsCtx(block: number, outputs: OutputData[], amount = 1000): TxContext {
    return {
      block,
      inputIndex: 0,
      inputs: [{ amount, tokenId: '0x00', coinId: '0xabc', address: COVENANT }],
      outputs,
      state: s({ 100: 500, 101: 600 }),
      prevState: s({ 100: 500, 101: 600 }),
      simulationMode: true,
    };
  }

  it('pays the fixed payout and returns the remainder to the owner', () => {
    const tx = outputsCtx(550, [
      { address: beneficiaryAddr, amount: 400, tokenId: '0x00', keepState: false },
      { address: ownerAddr, amount: 600, tokenId: '0x00', keepState: true },
    ]);
    expect(run(partial, tx, [pkBENEFICIARY]).success).toBe(true);
  });

  it('rejects a misdirected remainder', () => {
    const tx = outputsCtx(550, [
      { address: beneficiaryAddr, amount: 400, tokenId: '0x00', keepState: false },
      { address: '0x' + '99'.repeat(32), amount: 600, tokenId: '0x00', keepState: true },
    ]);
    expect(run(partial, tx, [pkBENEFICIARY]).success).toBe(false);
  });

  it('rejects a payout larger than the balance', () => {
    const tx = outputsCtx(550, [{ address: beneficiaryAddr, amount: 400, tokenId: '0x00', keepState: false }], 300);
    expect(run(partial, tx, [pkBENEFICIARY]).success).toBe(false);
  });
});

describe('exerciseCovenantStateVariables', () => {
  it('returns maturity and recovery ports by default', () => {
    expect(exerciseCovenantStateVariables({ maturityBlock: 500n, recoveryBlock: 600n })).toEqual([
      { port: 100, value: 500n, type: 'number' },
      { port: 101, value: 600n, type: 'number' },
    ]);
  });

  it('rejects a recovery block at or before maturity', () => {
    expect(() => exerciseCovenantStateVariables({ maturityBlock: 600n, recoveryBlock: 600n })).toThrow();
  });
});

describe('buildExerciseCovenant validation', () => {
  it('rejects a non-hex beneficiary', () => {
    expect(() => buildExerciseCovenant({ kind: 'unilateral-exercise', beneficiary: 'not-hex', recovery: pkOWNER })).toThrow();
  });

  it('rejects an out-of-range port', () => {
    expect(() =>
      buildExerciseCovenant({ kind: 'unilateral-exercise', beneficiary: pkBENEFICIARY, recovery: pkOWNER, maturityPort: 300 }),
    ).toThrow();
  });
});
