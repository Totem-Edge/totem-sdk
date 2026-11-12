/**
 * CAN-001: a transaction may burn value, never create it.
 *
 * The node rejects an unbalanced transaction, so buildTransaction must fail at
 * build time instead of deferring an opaque broadcast error.
 */
import { createSignedByDescriptor } from '@totemsdk/core/scripts';
import { buildTransaction } from '../index.js';
import type { EnhancedBuildParams } from '../index.js';

const OWNER = '0x' + '11'.repeat(32);
const RECIPIENT = '0x' + '22'.repeat(32);
const PUBKEY = '33'.repeat(32);

function params(inputAmount: string, outputAmounts: string[]): EnhancedBuildParams {
  return {
    inputs: [
      {
        coinId: '0x' + 'aa'.repeat(32),
        address: OWNER,
        amount: inputAmount,
        tokenId: '0x00',
        scriptDescriptor: createSignedByDescriptor(OWNER, PUBKEY),
      },
    ],
    outputs: outputAmounts.map((amount, index) => ({
      address: RECIPIENT,
      amount,
      tokenId: '0x00',
      ...(index === 0 ? { state: [] } : {}),
    })),
  } as unknown as EnhancedBuildParams;
}

describe('CAN-001 — transaction conservation', () => {
  it('builds a balanced transaction', () => {
    const result = buildTransaction(params('1000', ['600', '400']));
    expect(result.serialized.length).toBeGreaterThan(0);
  });

  it('allows an explicit burn (outputs below inputs)', () => {
    expect(() => buildTransaction(params('1000', ['900']))).not.toThrow();
  });

  it('rejects outputs that exceed inputs', () => {
    expect(() => buildTransaction(params('1000', ['1000', '1']))).toThrow(/Unbalanced transaction/);
  });

  it('rejects creation in a non-native token', () => {
    const base = params('1000', ['1000']);
    const tokenParams = {
      ...base,
      inputs: base.inputs.map((input) => ({ ...input, tokenId: '0x' + 'cc'.repeat(32) })),
      outputs: base.outputs.map((output) => ({
        ...output,
        tokenId: '0x' + 'cc'.repeat(32),
        amount: '1500',
      })),
    } as unknown as EnhancedBuildParams;
    expect(() => buildTransaction(tokenParams)).toThrow(/Unbalanced transaction/);
  });
});
