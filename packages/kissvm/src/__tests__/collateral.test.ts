/**
 * OMP-21 collateral bond — template logic (RFC-048 §2, RFC-050 §6).
 *
 * kissvm jest maps `@totemsdk/core` to a mock, so real WOTS verification is not
 * available here; these tests use `simulationMode` to exercise the *branch logic*
 * (objective-condition liquidation, borrower reclaim, lender release). Real
 * signatures across both VMs are covered by `scripts/exercise-exec-vm.mjs`.
 */

import { evaluateScript } from '../index';
import type { ScriptWitness, TxContext } from '../index';
import { buildCollateralBondScript, collateralBondStateVariables } from '../templates/collateral';

const pkBORROWER = 'bb'.repeat(32);
const pkLENDER = 'aa'.repeat(32);
const COVENANT = '0x' + 'dd'.repeat(32);
const MATURITY = 600;

function s(entries: Record<number, string | number>): Record<number, string> {
  const r: Record<number, string> = {};
  for (const [k, v] of Object.entries(entries)) r[Number(k)] = String(v);
  return r;
}

function bondCtx(block: number, to: string, amount = 1000): TxContext {
  return {
    block,
    inputIndex: 0,
    inputs: [{ amount, tokenId: '0x00', coinId: '0xabc', address: COVENANT }],
    outputs: [{ address: to, amount, tokenId: '0x00', keepState: false }],
    state: s({ 100: MATURITY }),
    prevState: s({ 100: MATURITY }),
    simulationMode: true,
  };
}

function run(script: string, tx: TxContext, signers: string[] = []) {
  const witness: ScriptWitness = { signatures: new Map(signers.map((pk) => [pk, new Uint8Array([1])])) };
  return evaluateScript(script, witness, tx);
}

const borrowerAddr = '0x' + pkBORROWER;
const lenderAddr = '0x' + pkLENDER;

describe('OMP-21 collateral bond', () => {
  const bond = buildCollateralBondScript({
    borrower: pkBORROWER,
    lender: pkLENDER,
    liquidationCondition: '@BLOCK GTE 500',
  });

  it('lender releases collateral to the borrower after repayment', () => {
    expect(run(bond, bondCtx(550, borrowerAddr), [pkLENDER]).success).toBe(true);
  });

  it('objective default before maturity lets the lender seize (permissionless)', () => {
    expect(run(bond, bondCtx(550, lenderAddr), []).success).toBe(true);
  });

  it('borrower cannot reclaim before maturity when not released', () => {
    expect(run(bond, bondCtx(550, borrowerAddr), []).success).toBe(false);
  });

  it('after maturity with default, the lender seizes and the borrower cannot race', () => {
    expect(run(bond, bondCtx(650, lenderAddr), []).success).toBe(true);
    expect(run(bond, bondCtx(650, borrowerAddr), []).success).toBe(false);
  });

  it('after maturity with no default, the borrower reclaims', () => {
    const noDefault = buildCollateralBondScript({
      borrower: pkBORROWER,
      lender: pkLENDER,
      liquidationCondition: '@BLOCK GTE 999',
    });
    expect(run(noDefault, bondCtx(650, borrowerAddr), []).success).toBe(true);
    expect(run(noDefault, bondCtx(650, lenderAddr), []).success).toBe(false);
  });

  it('emits objective-condition and no-discretion markers', () => {
    expect(bond).toContain('VERIFYOUT(');
    expect(bond).toContain('ASSERT SAMESTATE(100 100)');
    expect(bond).toContain(`VERIFYOUT(0 0x${pkLENDER} @AMOUNT 0x00 FALSE)`);
    expect(bond).toContain(`VERIFYOUT(0 0x${pkBORROWER} @AMOUNT 0x00 FALSE)`);
  });

  it('requires an objective liquidation condition', () => {
    expect(() => buildCollateralBondScript({ borrower: pkBORROWER, lender: pkLENDER, liquidationCondition: '' })).toThrow();
  });

  it('rejects a non-hex borrower', () => {
    expect(() =>
      buildCollateralBondScript({ borrower: 'nope', lender: pkLENDER, liquidationCondition: '@BLOCK GTE 500' }),
    ).toThrow();
  });
});

describe('collateralBondStateVariables', () => {
  it('returns the maturity port by default', () => {
    expect(collateralBondStateVariables({ maturityBlock: 600n })).toEqual([{ port: 100, value: 600n, type: 'number' }]);
  });
});
