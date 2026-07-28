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
