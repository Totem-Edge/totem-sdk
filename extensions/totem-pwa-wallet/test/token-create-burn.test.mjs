import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertTokenCreateBalanced,
  isTokenCreateBalanced,
} from '../src/core/tokenCreateBurn.ts';

test('burn is omitted from outputs, not added to token supply', () => {
  const colorminima = 1_000_000n;
  const burn = 100_000n;
  const inputs = colorminima + burn;
  const tokenOutput = colorminima;

  assert.equal(isTokenCreateBalanced(inputs, tokenOutput, burn), true);
  assert.doesNotThrow(() => assertTokenCreateBalanced(inputs, tokenOutput, burn));
});

test('minting the burn into the token output is rejected', () => {
  const colorminima = 1_000_000n;
  const burn = 100_000n;
  const inputs = colorminima + burn;

  assert.equal(isTokenCreateBalanced(inputs, colorminima + burn, burn), false);
  assert.throws(
    () => assertTokenCreateBalanced(inputs, colorminima + burn, burn),
    /does not balance/,
  );
});

test('zero burn preserves the plain supply invariant', () => {
  assert.equal(isTokenCreateBalanced(500n, 500n, 0n), true);
  assert.equal(isTokenCreateBalanced(500n, 499n, 0n), false);
});

test('refunding burn is rejected', () => {
  const colorminima = 1_000_000n;
  const burn = 100_000n;
  const inputs = colorminima + burn;

  // Returning burn as change/output would make outputs exceed inputs - burn.
  assert.equal(isTokenCreateBalanced(inputs, inputs, burn), false);
});
