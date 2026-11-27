/**
 * OMN-124: every package must agree on confirmation depth.
 *
 * Omnia's `confirmationsAt` and chain-provider's deposit gate now share one
 * definition: a coin created in block `created` has `tip - created`
 * confirmations. This suite pins the boundary and proves the two packages agree.
 */
import { confirmationDepth } from '@totemsdk/core';
import { confirmationsAt } from '../chain-truth';

describe('OMN-124: one confirmation definition', () => {
  it.each([
    [100, 100, 0],
    [100, 101, 1],
    [100, 110, 10],
  ])('agrees at created=%i tip=%i', (created, tip, expected) => {
    expect(confirmationsAt({ created }, tip)).toBe(expected);
    expect(confirmationDepth(created, tip)).toBe(expected);
  });

  it('fails closed for a future-dated or unknown coin in both packages', () => {
    expect(confirmationsAt({ created: 101 }, 100)).toBeNull();
    expect(confirmationDepth(101, 100)).toBeNull();
    expect(confirmationsAt({}, 100)).toBeNull();
    expect(confirmationDepth(undefined, 100)).toBeNull();
  });
});
