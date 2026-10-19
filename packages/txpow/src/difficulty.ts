/**
 * difficulty.ts — Fetch and manage the TxPoW difficulty target.
 *
 * The live value comes from `GET /v1/wallet/txpow-params` on the Axia API.
 * On any error (timeout, network failure, invalid response) we fall back to
 * the hardcoded TX_POW_MIN_DIFFICULTY constant, which is the protocol floor.
 */

import { TX_POW_MIN_DIFFICULTY } from './constants.js';

export interface TxPowParams {
  minTxPowWork: string;
}

/** Anything that can expose a node's live minimum TxPoW work (hex). */
export interface MinWorkSource {
  getMinTxPowWork?(): Promise<string | null>;
}

/**
 * Convert a live `currentmintxpowwork` value (32-byte hex target) into a mining
 * target, applying the same 10% margin the node's own wallet uses
 * (`minwork * 10 / 11`, see Java `TxPoWGenerator.generateTxPoW`).
 *
 * `TxPoWChecker.checkTxPoWSimple` rejects only when
 * `txnDifficulty > magic.getMinTxPowWork()`, so a target that is harder than
 * the live minimum is always accepted; the margin absorbs the tiny per-block
 * Magic retarget.
 */
export function targetFromMinWork(minWorkHex: string): Uint8Array {
  const clean = minWorkHex.replace(/^0x/i, '').trim();
  if (clean.length === 0 || clean.length > 64 || !/^[0-9a-fA-F]+$/.test(clean)) {
    throw new Error(`Invalid minTxPowWork: ${minWorkHex}`);
  }
  const value = BigInt('0x' + clean);
  const adjusted = (value * 10n) / 11n;
  const target = adjusted > 0n ? adjusted : value;

  let hex = target.toString(16);
  if (hex.length % 2 !== 0) hex = '0' + hex;
  while (hex.length < 64) hex = '0' + hex;

  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/**
 * Resolve the TxPoW mining target from a live node when it exposes
 * `getMinTxPowWork()`, otherwise fall back to `TX_POW_MIN_DIFFICULTY`.
 *
 * Never throws: a node/protocol hiccup must not block transaction
 * construction. The fallback is the protocol default target (MAX/1e6), which
 * is harder than the network hard floor (`Magic.MIN_HASHES = 10000`).
 */
export async function resolveTxPowTarget(
  source?: MinWorkSource | null,
  fallback: Uint8Array = TX_POW_MIN_DIFFICULTY,
): Promise<Uint8Array> {
  try {
    const hex = await source?.getMinTxPowWork?.();
    if (hex) {
      const target = targetFromMinWork(hex);
      if (target.some((b) => b !== 0)) return target;
    }
  } catch {
    // fall through to the constant
  }
  return new Uint8Array(fallback);
}

function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < h.length; i += 2) {
    out[i / 2] = parseInt(h.slice(i, i + 2), 16);
  }
  return out;
}

/**
 * Fetch the current minimum TxPoW work from the Axia API.
 *
 * Falls back to TX_POW_MIN_DIFFICULTY (the hardcoded protocol floor) on any
 * error: network failure, timeout, or malformed response.
 *
 * @param axiaBaseUrl  Base URL of the Axia API, e.g. "https://api.axia.to"
 * @param timeoutMs    Request timeout in ms (default: 3000)
 */
export async function fetchTxPowTarget(
  axiaBaseUrl: string,
  timeoutMs = 3000
): Promise<Uint8Array> {
  try {
    const base = axiaBaseUrl.replace(/\/$/, '');
    const url = `${base}/v1/wallet/txpow-params`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = (await response.json()) as TxPowParams;
    if (typeof data.minTxPowWork !== 'string') {
      throw new Error('Missing minTxPowWork field');
    }

    const clean = data.minTxPowWork.replace('0x', '').replace(/\s/g, '');
    if (clean.length !== 64) {
      throw new Error(`Invalid minTxPowWork length: ${clean.length} (expected 64 hex chars)`);
    }

    return hexToBytes(clean);
  } catch {
    return new Uint8Array(TX_POW_MIN_DIFFICULTY);
  }
}
