/**
 * Single in-flight queue for WOTS index allocation + signing (AUD-002).
 *
 * Serializes reserve / release / markUsed so concurrent verify/sign/send
 * requests can never observe or reuse the same one-time-signature leaf.
 * Shared by the background message handlers and the Hawk transaction backend.
 */

let signingLock: Promise<unknown> = Promise.resolve();

export function withSigningLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = signingLock.then(fn, fn);
  signingLock = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
