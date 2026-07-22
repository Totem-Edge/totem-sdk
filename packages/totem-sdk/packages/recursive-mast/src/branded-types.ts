/**
 * Branded types for security-critical time and block values.
 *
 * Prevents accidental mixing of Unix timestamps (ms), Unix timestamps
 * (seconds), block heights, and block durations. All are `number` at
 * runtime but carry distinct type brands at compile time.
 */

declare const BlockHeightBrand: unique symbol;
declare const BlockDurationBrand: unique symbol;
declare const UnixTimeMsBrand: unique symbol;
declare const UnixTimeSecBrand: unique symbol;

export type BlockHeight = number & { [BlockHeightBrand]: true };
export type BlockDuration = number & { [BlockDurationBrand]: true };
export type UnixTimeMs = number & { [UnixTimeMsBrand]: true };
export type UnixTimeSec = number & { [UnixTimeSecBrand]: true };

export function asBlockHeight(n: number): BlockHeight {
  if (!Number.isInteger(n) || n < 0) throw new Error(`Invalid block height: ${n}`);
  return n as BlockHeight;
}

export function asBlockDuration(n: number): BlockDuration {
  if (!Number.isInteger(n) || n < 0) throw new Error(`Invalid block duration: ${n}`);
  return n as BlockDuration;
}

export function asUnixTimeMs(n: number): UnixTimeMs {
  if (!Number.isInteger(n) || n < 0) throw new Error(`Invalid Unix time ms: ${n}`);
  return n as UnixTimeMs;
}

export function asUnixTimeSec(n: number): UnixTimeSec {
  if (!Number.isInteger(n) || n < 0) throw new Error(`Invalid Unix time sec: ${n}`);
  return n as UnixTimeSec;
}

export function unixTimeMsToSec(ms: UnixTimeMs): UnixTimeSec {
  return asUnixTimeSec(Math.floor(ms / 1000));
}

export function unixTimeSecToMs(sec: UnixTimeSec): UnixTimeMs {
  return asUnixTimeMs(sec * 1000);
}

export function nowMs(): UnixTimeMs {
  return asUnixTimeMs(Date.now());
}

export function nowSec(): UnixTimeSec {
  return unixTimeMsToSec(nowMs());
}
