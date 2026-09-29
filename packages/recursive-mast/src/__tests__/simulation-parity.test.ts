/**
 * RFC-020 RM-SIM-001: simulation must evaluate exactly what production
 * evaluates. A witness plan without verifiable ScriptProofs must fail closed
 * (production MAST cannot resolve unverified branches), unless the caller
 * explicitly opts into the dev-only legacy path.
 */
import type { CoinData, TxContext } from '@totemsdk/kissvm';
import { simulatePolicyTransaction } from '../kissvm/simulation.js';
import type { RecursiveWitnessPlan } from '../kissvm/witness-adapter.js';

const coin: CoinData = { amount: 100, tokenId: '0x00', coinId: '0xabc', address: '0xAA' };
const ctx: TxContext = {
  block: 1000,
  inputIndex: 0,
  inputs: [coin],
  outputs: [],
  state: {},
  prevState: {},
  simulationMode: true,
};

function plan(over: Partial<RecursiveWitnessPlan> = {}): RecursiveWitnessPlan {
  return { mastBranches: new Map(), signatures: new Map(), ...over };
}

describe('RFC-020 RM-SIM-001: simulation/production parity', () => {
  it('fails a proof-less plan instead of simulating through legacy mastBranches', async () => {
    const result = await simulatePolicyTransaction(
      'RETURN TRUE',
      coin,
      ctx,
      plan({ mastBranches: new Map([['0xaa', 'RETURN TRUE']]) }),
    );
    expect(result.passed).toBe(false);
    expect(result.error).toMatch(/no scriptProofs/);
  });

  it('proceeds only when the caller explicitly opts into legacy simulation', async () => {
    const result = await simulatePolicyTransaction(
      'RETURN TRUE',
      coin,
      ctx,
      plan({ mastBranches: new Map([['0xaa', 'RETURN TRUE']]) }),
      { allowLegacyMastBranches: true },
    );
    expect(result.passed).toBe(true);
  });

  it('proceeds when the plan carries ScriptProofs (canonical path)', async () => {
    const result = await simulatePolicyTransaction(
      'RETURN TRUE',
      coin,
      ctx,
      plan({ scriptProofs: [{ script: 'RETURN TRUE', proofHex: '', address: '0xaa' }] }),
    );
    expect(result.passed).toBe(true);
  });
});
