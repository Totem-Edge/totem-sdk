/**
 * Key Worker — runs heavy WOTS derivation off the main thread
 *
 * Messages in:
 *   { type: 'derive', baseSeed: number[], index: number, reqId: string }
 *
 * Messages out:
 *   { type: 'derived', reqId, address, publicKey } | { type: 'error', reqId, error }
 */
import {
  createUnifiedChildTreeKeyAsync,
  scriptFromWotsPk,
  scriptToAddress,
} from '@totemsdk/core';
import { ensureWasm } from '../core/wasm';

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

self.onmessage = async (e: MessageEvent) => {
  const { type, baseSeed, index, reqId } = e.data;
  if (type !== 'derive') return;

  try {
    // Each worker realm has its own WASM module instance — initialise it here
    // before any @totemsdk/core crypto call.
    await ensureWasm();
    const seed = new Uint8Array(baseSeed as number[]);
    const treeKey = await createUnifiedChildTreeKeyAsync(seed, index);
    const pubKey = treeKey.getPublicKey() as Uint8Array;
    const script = scriptFromWotsPk(pubKey);
    const address = scriptToAddress(script);
    const publicKey = toHex(pubKey);
    self.postMessage({ type: 'derived', reqId, address, publicKey });
  } catch (err) {
    self.postMessage({ type: 'error', reqId, error: String(err) });
  }
};
