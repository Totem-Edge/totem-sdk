/**
 * mine-wasm.ts — WASM mining loop loader and wrapper.
 *
 * Loads the pre-compiled `miner.wasm` binary and provides `mineChunkWasm()`.
 * Falls back gracefully when the binary is unavailable.
 *
 * ── Memory layout (must match miner.wat) ──
 *   [0  .. 31 ] — hash output buffer (host sha3_256 writes here)
 *   [32 .. 32+headerLen-1 ] — header buffer  (set by caller before each call)
 *   [32+headerLen .. 32+headerLen+31] — target buffer (set once per mine)
 *
 * ── Runtime detection ──
 *   Node.js  → reads dist/wasm/miner.wasm via fs.readFileSync
 *   Browser  → fetches the URL supplied by setWasmUrl() (Task #114 supplies it)
 *
 * ── WASM binary compilation ──
 *   node scripts/compile-wasm.js   (uses wabt npm package, no Emscripten needed)
 *   npm run build                  (postbuild copies miner.wasm → dist/wasm/)
 *
 * ── WASM module interface (miner.wat) ──
 *   import env.sha3_256(headerPtr, headerLen, outPtr)  ← host provides via @noble/hashes
 *   export mine(headerPtr, headerLen, nonceOffset, nonceLen,
 *               targetPtr, startNonce, chunkSize) → i32
 *   export memory
 *
 * mine() returns the found nonce, or -1 (0xFFFFFFFF) if no nonce found in chunk.
 */

import { sha3_256 as nobleSha3_256 } from '@noble/hashes/sha3.js';

/** Byte offset in WASM linear memory where the hash output is written. */
const HASH_OUT_OFFSET = 0;
/** First byte of the header region (after the 32-byte hash output buffer). */
export const WASM_HEADER_OFFSET = 32;
/**
 * Sentinel returned by WASM mine() when no nonce is found in the chunk.
 * The WAT uses `i32.const -1` (= 0xFFFFFFFF bit pattern).
 * WebAssembly i32 return values are sign-extended to JavaScript Number,
 * so 0xFFFFFFFF arrives as -1, NOT as 4294967295.
 */
const NOT_FOUND = -1;

// ─────────────────────────────────────────────────────────────────────────────
// Browser WASM URL configuration
// ─────────────────────────────────────────────────────────────────────────────

let _browserWasmUrl: string | null = null;

/**
 * Configure the URL from which the browser loads `miner.wasm`.
 *
 * Call this once at app startup in browser contexts. The extension build
 * (Task #114) resolves this URL from the bundler's output.
 *
 * @example
 *   import { setWasmUrl } from '@totemsdk/txpow';
 *   setWasmUrl(browser.runtime.getURL('miner.wasm'));
 */
export function setWasmUrl(url: string): void {
  _browserWasmUrl = url;
  _loadAttempted = false;
  _instance = null;
  _memory = null;
}

/**
 * Return the current browser WASM URL, or null if not yet configured.
 * Used by the main thread to pass the URL into spawned browser Web Workers.
 */
export function getBrowserWasmUrl(): string | null {
  return _browserWasmUrl;
}

// ─────────────────────────────────────────────────────────────────────────────
// WASM instance lifecycle
// ─────────────────────────────────────────────────────────────────────────────

interface MinerExports extends WebAssembly.Exports {
  mine: (
    headerPtr: number,
    headerLen: number,
    nonceOffset: number,
    nonceLen: number,
    targetPtr: number,
    startNonce: number,
    chunkSize: number
  ) => number;
  memory: WebAssembly.Memory;
}

let _instance: WebAssembly.Instance | null = null;
let _memory: WebAssembly.Memory | null = null;
let _loadAttempted = false;

/** Build the WebAssembly import object, wiring sha3_256 from @noble/hashes. */
function buildImports(): WebAssembly.Imports {
  return {
    env: {
      /**
       * sha3_256(headerPtr, headerLen, outPtr)
       * Reads header bytes from WASM linear memory, computes SHA3-256,
       * writes 32-byte digest back into WASM linear memory at outPtr.
       */
      sha3_256(headerPtr: number, headerLen: number, outPtr: number): void {
        if (!_memory) return;
        const memView = new Uint8Array(_memory.buffer);
        // Slice to get a clean copy unaffected by future mutations
        const input = memView.slice(headerPtr, headerPtr + headerLen);
        const hash = nobleSha3_256(input);
        memView.set(hash, outPtr);
      },
    },
  };
}

/**
 * Load the WASM binary once per process (idempotent).
 * Returns the instantiated module, or null if unavailable.
 */
async function loadWasm(): Promise<WebAssembly.Instance | null> {
  if (_loadAttempted) return _instance;
  _loadAttempted = true;

  if (typeof WebAssembly === 'undefined') return null;

  try {
    let wasmBytes: Uint8Array;

    if (typeof process !== 'undefined' && process.versions?.node) {
      // ── Node.js path ──────────────────────────────────────────────────────
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const fs = require('fs') as typeof import('fs');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const path = require('path') as typeof import('path');
      const wasmPath = path.join(__dirname, 'wasm', 'miner.wasm');
      if (!fs.existsSync(wasmPath)) return null;

      // Use new Uint8Array(nodeBuffer) — correct copy that respects
      // Buffer byteOffset/byteLength, avoiding the shared pool pitfall
      // of accessing .buffer directly on a pooled Node.js Buffer.
      const nodeBuffer: Buffer = fs.readFileSync(wasmPath);
      wasmBytes = new Uint8Array(nodeBuffer);
    } else if (_browserWasmUrl !== null) {
      // ── Browser path ──────────────────────────────────────────────────────
      const resp = await (globalThis as any).fetch(_browserWasmUrl);
      if (!resp.ok) return null;
      const ab: ArrayBuffer = await resp.arrayBuffer();
      wasmBytes = new Uint8Array(ab);
    } else {
      // Browser context but no URL configured yet.
      // Call setWasmUrl() to enable WASM in the browser (Task #114).
      return null;
    }

    // Compile and instantiate with host imports
    const buf = wasmBytes.buffer.slice(
      wasmBytes.byteOffset,
      wasmBytes.byteOffset + wasmBytes.byteLength
    ) as ArrayBuffer;
    const wasmModule = await WebAssembly.compile(buf);
    const instance = await WebAssembly.instantiate(wasmModule, buildImports());
    const exports = instance.exports as MinerExports;

    if (typeof exports.mine !== 'function') return null;
    if (!(exports.memory instanceof WebAssembly.Memory)) return null;

    _instance = instance;
    _memory = exports.memory;
    return _instance;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true when the WASM binary is loaded and `mine` is ready to use.
 * Cached after the first call; subsequent calls are synchronous (via memoised flag).
 */
export async function isWasmAvailable(): Promise<boolean> {
  return (await loadWasm()) !== null;
}

/**
 * Mine a chunk using the WASM binary.
 *
 * Copies `headerBuf` and `target` into WASM linear memory at the correct
 * offsets, calls `mine()`, and returns the found nonce — or `null` if:
 *   - WASM binary is unavailable
 *   - No valid nonce was found within the specified chunk
 *
 * Grows WASM memory if needed (single-page default = 64 KB is ample for
 * any realistic TxHeader, but growth is handled for safety).
 *
 * @param headerBuf   Full TxHeader bytes for the current nonce encoding range.
 * @param nonceOffset Byte offset of the nonce VALUE in the header (always 2).
 * @param nonceLen    Byte length of the nonce value (1 for 0–127, 2 for 128–32767, …).
 * @param target      32-byte difficulty target (big-endian).
 * @param startNonce  First nonce value to try.
 * @param chunkCount  Number of consecutive nonce values to try.
 */
export async function mineChunkWasm(
  headerBuf: Uint8Array,
  nonceOffset: number,
  nonceLen: number,
  target: Uint8Array,
  startNonce: bigint,
  chunkCount: bigint
): Promise<bigint | null> {
  const inst = await loadWasm();
  if (!inst || !_memory) return null;

  // Renamed to wasmExports to avoid shadowing the CJS module-level `exports` object.
  // If named `exports`, `exports.WASM_HEADER_OFFSET` would resolve to the WASM
  // instance exports (which has no such property → undefined), making headerPtr=0.
  const wasmExports = inst.exports as MinerExports;

  // Memory layout: [0..31]=hash output, [32..32+headerLen-1]=header, [32+headerLen..32+headerLen+31]=target
  const headerPtr = WASM_HEADER_OFFSET;
  const targetPtr = headerPtr + headerBuf.length;
  const totalNeeded = targetPtr + 32;

  // Grow memory if necessary
  let memView = new Uint8Array(_memory.buffer);
  if (memView.byteLength < totalNeeded) {
    const pagesNeeded = Math.ceil((totalNeeded - memView.byteLength) / 65536) + 1;
    try {
      _memory.grow(pagesNeeded);
      memView = new Uint8Array(_memory.buffer);
    } catch {
      return null;
    }
  }

  // Write header and target into WASM memory
  memView.set(headerBuf, headerPtr);
  memView.set(target, targetPtr);

  const result = wasmExports.mine(
    headerPtr,
    headerBuf.length,
    nonceOffset,
    nonceLen,
    targetPtr,
    Number(startNonce),
    Number(chunkCount)
  );

  // result === -1  →  no nonce found (WASM i32 0xFFFFFFFF sign-extended to JS -1)
  // result >= 0    →  found nonce; use >>> 0 to treat as unsigned before BigInt
  return result === NOT_FOUND ? null : BigInt(result >>> 0);
}
