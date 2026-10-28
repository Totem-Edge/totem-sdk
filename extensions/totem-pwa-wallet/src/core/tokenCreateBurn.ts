/**
 * Minima tokencreate burn accounting.
 *
 * Minima's Java tokencreate builds `sendamount = colorminima + burn`, creates
 * the token output for `colorminima`, and computes change from `sendamount`.
 * The burn is therefore neither token supply nor an output: it is destroyed by
 * the inputs-minus-outputs rule.
 */

export function isTokenCreateBalanced(
  inputTotal: bigint,
  outputTotal: bigint,
  burnTotal: bigint,
): boolean {
  if (inputTotal < 0n || outputTotal < 0n || burnTotal < 0n) return false;
  return inputTotal === outputTotal + burnTotal;
}

export function assertTokenCreateBalanced(
  inputTotal: bigint,
  outputTotal: bigint,
  burnTotal: bigint,
): void {
  if (!isTokenCreateBalanced(inputTotal, outputTotal, burnTotal)) {
    throw new Error(
      `Token creation does not balance: inputs=${inputTotal} outputs=${outputTotal} burn=${burnTotal}`,
    );
  }
}
