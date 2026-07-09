/**
 * mine.ts — Local TxPoW proof-of-work mining loop.
 *
 * Algorithm (from TxPoWChecker.java):
 *   txpowId = SHA3-256( serialize(TxHeader) )
 *   valid   = txpowId < mTxnDifficulty   (big-endian 256-bit comparison)
 *
 * Strategy:
 *   1. The TxBody is fixed during mining — only mNonce in the header changes.
 *   2. We precompute the "header tail" (everything after mNonce) once per mine.
 *   3. Within each chunk (fixed nonce encoding length), we update only the nonce
 *      value bytes in place — no per-iteration allocation.
 *   4. At each MiniNumber encoding boundary (nonce 128, 32768, 8388608, …) we
 *      re-allocate a new header buffer with the wider nonce field.
 *   5. Between chunks we yield to the event loop so the calling thread is never blocked.
 *   6. When the pre-compiled WASM binary is present (`dist/wasm/miner.wasm`), the
 *      inner loop runs in WASM for ~5-10x throughput. Falls back to pure JS otherwise.
 *   7. In Node.js (main thread), mining runs inside a `worker_threads` Worker so the
 *      event loop is never blocked. In browser contexts the in-process loop is used
 *      until Task #114 wires up the Web Worker entry point.
 *
 * Control-flow invariant (IMPORTANT):
 *   WASM and JS are mutually exclusive per chunk — we never re-mine a chunk that
 *   WASM already scanned. When WASM returns null (nonce not found in chunk), we
 *   advance to the next chunk rather than falling back to JS for the same range.
 *   This means `source` is always accurate: 'wasm' when the binary was used for
 *   the winning chunk; 'js' when the JS path found the nonce.
 */

import { sha3_256 } from '@noble/hashes/sha3.js';
import {
  writeMiniNumber,
  writeMiniData,
  writeHashToStream,
  concat,
} from '@totemsdk/core';
import { serializeMagic } from './magic.js';
import { MAX_HASH, ZERO_HASH, CASCADE_LEVELS, MAIN_NET_CHAIN_ID } from './constants.js';
import { mineChunkWasm, isWasmAvailable, getBrowserWasmUrl } from './mine-wasm.js';

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export interface MineResult {
  /** Fully serialized TxHeader bytes with the winning nonce. */
  minedHeaderBytes: Uint8Array;
  /** SHA3-256(minedHeaderBytes) — the canonical TxPoW ID. */
  txpowId: Uint8Array;
  nonce: bigint;
  elapsedMs: number;
  /** 'wasm' when the pre-compiled WASM binary found the nonce; 'js' otherwise. */
  source: 'wasm' | 'js';
}

export interface MineOptions {
  /**
   * Hash iterations per async yield (default: 10_000).
   * Lower = more responsive UI; higher = slightly faster mining.
   */
  chunkSize?: number;
  /**
   * Hard cap on total iterations (default: unlimited).
   * Throws if exhausted without finding a valid nonce.
   */
  maxIterations?: number;
  /** AbortSignal — rejects the Promise when aborted. */
  signal?: AbortSignal;
  /**
   * Override the header timestamp (milliseconds since epoch).
   * Defaults to Date.now(). Set a fixed value for deterministic testing.
   */
  timeMilli?: bigint;
  /**
   * Force the pure-JS mining path even when `miner.wasm` is present.
   * Useful for testing the JS fallback or comparing JS vs WASM performance.
   */
  forceJs?: boolean;
  /**
   * Internal: skip spawning a Node.js worker_threads Worker.
   * Set by node.worker.ts to prevent recursive worker creation.
   * Also forces in-process execution when set programmatically.
   * @internal
   */
  _skipWorker?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Big-endian 256-bit comparison: true if a < b.
 * Used to check: txpowId < mTxnDifficulty.
 */
export function isLessThan(a: Uint8Array, b: Uint8Array): boolean {
  for (let i = 0; i < 32; i++) {
    if (a[i] < b[i]) return true;
    if (a[i] > b[i]) return false;
  }
  return false;
}

/**
 * Returns the first nonce value that would require more bytes in its
 * MiniNumber encoding (i.e. the next boundary at 128, 32768, 8388608, …).
 *
 * Pattern: bigIntToByteArray(n) grows by 1 byte at 2^(8k−1) for k=1,2,3,…
 *   k=1: 2^7  = 128
 *   k=2: 2^15 = 32768
 *   k=3: 2^23 = 8388608
 */
function nextNonceBoundary(nonce: bigint): bigint {
  const nonceValueLen = writeMiniNumber(nonce).length - 2;
  return 2n ** BigInt(8 * nonceValueLen - 1);
}

/**
 * Build the "header tail" — the part of TxHeader that follows mNonce.
 *
 * This is computed once at the start of a mine and never changes during it.
 */
function buildHeaderTail(txBodyHash: Uint8Array, timeMilli: bigint): Uint8Array {
  return concat(
    writeMiniData(MAIN_NET_CHAIN_ID),
    writeMiniNumber(timeMilli),
    writeMiniNumber(0n),
    writeMiniData(MAX_HASH),
    new Uint8Array([CASCADE_LEVELS]),
    writeHashToStream(ZERO_HASH),
    writeHashToStream(ZERO_HASH),
    writeMiniNumber(0n),
    serializeMagic(),
    writeHashToStream(ZERO_HASH),
    writeHashToStream(txBodyHash)
  );
}

/**
 * Synchronously mine a chunk of nonces within a fixed encoding boundary.
 *
 * Mutates headerBuf in place — only the nonce value bytes at offset 2 change.
 * Returns the found nonce, or null if not found in this chunk.
 */
function mineChunkJs(
  headerBuf: Uint8Array,
  nonceValueLen: number,
  target: Uint8Array,
  startNonce: bigint,
  endNonce: bigint
): bigint | null {
  const nonceValueOffset = 2;

  for (let nonce = startNonce; nonce < endNonce; nonce++) {
    let n = nonce;
    for (let i = nonceValueLen - 1; i >= 0; i--) {
      headerBuf[nonceValueOffset + i] = Number(n & 0xffn);
      n >>= 8n;
    }
    const hash = sha3_256(headerBuf);
    if (isLessThan(hash, target)) return nonce;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Browser Web Worker dispatch (optional URL-based)
// ─────────────────────────────────────────────────────────────────────────────

let _browserWorkerUrl: string | null = null;

/**
 * Configure the URL of the browser.worker.js bundle so that `mineTxPoW()`
 * can spawn a Web Worker in browser contexts.
 *
 * Call this once at extension/dApp startup. The bundled worker file exposes
 * the same message protocol as node.worker.ts.
 *
 * @example
 *   import { setBrowserWorkerUrl } from '@totemsdk/txpow';
 *   setBrowserWorkerUrl(browser.runtime.getURL('mine-worker.js'));
 */
export function setBrowserWorkerUrl(url: string): void {
  _browserWorkerUrl = url;
}

/**
 * Spawn a browser Web Worker to run the mining loop off the main thread.
 * Requires a prior call to setBrowserWorkerUrl() to configure the worker URL.
 */
async function mineTxPoWViaBrowserWorker(
  txBodyBytes: Uint8Array,
  txnDifficulty: Uint8Array,
  options?: MineOptions
): Promise<MineResult> {
  if (!_browserWorkerUrl) {
    throw new Error(
      'Browser Web Worker URL not configured. Call setBrowserWorkerUrl() first.'
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const WorkerClass = (globalThis as any).Worker as typeof Worker;
  const worker = new WorkerClass(_browserWorkerUrl);

  return new Promise<MineResult>((resolve, reject) => {
    let settled = false;
    const settle = (fn: () => void): void => {
      if (!settled) {
        settled = true;
        fn();
      }
    };

    if (options?.signal) {
      const abortHandler = (): void => {
        settle(() =>
          reject(new DOMException('Mining aborted', 'AbortError'))
        );
        worker.terminate();
      };
      if (options.signal.aborted) {
        abortHandler();
        return;
      }
      options.signal.addEventListener('abort', abortHandler, { once: true });
    }

    worker.onmessage = (e: MessageEvent<Record<string, unknown>>): void => {
      const msg = e.data;
      if (msg['error']) {
        settle(() => reject(new Error(String(msg['error']))));
      } else {
        settle(() =>
          resolve({
            minedHeaderBytes: Uint8Array.from(msg['minedHeaderBytes'] as number[]),
            txpowId: Uint8Array.from(msg['txpowId'] as number[]),
            nonce: BigInt(msg['nonce'] as string),
            elapsedMs: msg['elapsedMs'] as number,
            source: msg['source'] as 'wasm' | 'js',
          })
        );
      }
    };

    worker.onerror = (e: ErrorEvent): void => {
      settle(() => reject(new Error(e.message)));
    };

    // Pass the WASM URL so the worker can call setWasmUrl() in its own JS context.
    // Web Workers have isolated module state — the main thread's setWasmUrl() call
    // does not carry over. Without this the worker mines in pure JS.
    const wasmUrl = getBrowserWasmUrl();
    worker.postMessage({
      txBodyBytes: Array.from(txBodyBytes),
      txnDifficulty: Array.from(txnDifficulty),
      wasmUrl: wasmUrl ?? undefined,
      chunkSize: options?.chunkSize,
      maxIterations:
        options?.maxIterations !== undefined
          ? options.maxIterations.toString()
          : undefined,
      timeMilli:
        options?.timeMilli !== undefined
          ? options.timeMilli.toString()
          : undefined,
      forceJs: options?.forceJs,
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Node.js worker_threads dispatch
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true when mining should be delegated to a Node.js worker_threads Worker.
 *
 * Conditions for using a worker:
 *   - Running in Node.js (process.versions.node is set)
 *   - Not already inside a worker thread (isMainThread === true)
 *   - _skipWorker option is not set
 *   - Not in a Jest test environment (ts-jest runs from source, dist/workers/*.js
 *     may not exist yet; Jest's own worker processes also have isMainThread=false
 *     which handles the common --maxWorkers case automatically)
 */
function shouldUseNodeWorker(options?: MineOptions): boolean {
  if (options?._skipWorker) return false;
  if (typeof process === 'undefined' || !process.versions?.node) return false;

  // In Jest, skip worker spawning: source workers are not compiled .js files
  // and Jest's own worker pool already sets isMainThread=false for most runners.
  if (
    process.env.NODE_ENV === 'test' ||
    process.env.JEST_WORKER_ID !== undefined
  ) {
    return false;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const wt = require('worker_threads') as typeof import('worker_threads');
    return wt.isMainThread;
  } catch {
    return false;
  }
}

/**
 * Dispatch mining to a Node.js `worker_threads` Worker.
 * The worker runs `mineTxPoWInProcess` with `_skipWorker: true` to prevent
 * recursive worker spawning.
 */
async function mineTxPoWViaNodeWorker(
  txBodyBytes: Uint8Array,
  txnDifficulty: Uint8Array,
  options?: MineOptions
): Promise<MineResult> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Worker } = require('worker_threads') as typeof import('worker_threads');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { join } = require('path') as typeof import('path');

  const workerPath = join(__dirname, 'workers', 'node.worker.js');

  return new Promise<MineResult>((resolve, reject) => {
    let settled = false;
    const settle = (fn: () => void): void => {
      if (!settled) {
        settled = true;
        fn();
      }
    };

    const worker = new Worker(workerPath, {
      workerData: {
        txBodyBytes: Array.from(txBodyBytes),
        txnDifficulty: Array.from(txnDifficulty),
        chunkSize: options?.chunkSize,
        maxIterations:
          options?.maxIterations !== undefined
            ? options.maxIterations.toString()
            : undefined,
        timeMilli:
          options?.timeMilli !== undefined
            ? options.timeMilli.toString()
            : undefined,
        forceJs: options?.forceJs,
      },
    });

    if (options?.signal) {
      const abortHandler = (): void => {
        settle(() =>
          reject(new DOMException('Mining aborted', 'AbortError'))
        );
        worker.terminate().catch(() => {});
      };
      if (options.signal.aborted) {
        abortHandler();
        return;
      }
      options.signal.addEventListener('abort', abortHandler, { once: true });
    }

    worker.on('message', (msg: Record<string, unknown>) => {
      if (msg['error']) {
        settle(() => reject(new Error(String(msg['error']))));
      } else {
        settle(() =>
          resolve({
            minedHeaderBytes: Uint8Array.from(msg['minedHeaderBytes'] as number[]),
            txpowId: Uint8Array.from(msg['txpowId'] as number[]),
            nonce: BigInt(msg['nonce'] as string),
            elapsedMs: msg['elapsedMs'] as number,
            source: msg['source'] as 'wasm' | 'js',
          })
        );
      }
    });

    worker.on('error', (err: Error) => settle(() => reject(err)));
    worker.on('exit', (code: number) => {
      if (code !== 0) {
        settle(() =>
          reject(new Error(`Mining worker exited with non-zero code ${code}`))
        );
      }
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// In-process mining loop
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run the mining loop in the current thread/task.
 * Called directly by the Node.js worker, and by the browser code path.
 */
export async function mineTxPoWInProcess(
  txBodyBytes: Uint8Array,
  txnDifficulty: Uint8Array,
  options?: MineOptions
): Promise<MineResult> {
  const chunkSize = BigInt(options?.chunkSize ?? 10_000);
  const maxIterations =
    options?.maxIterations !== undefined
      ? BigInt(options.maxIterations)
      : undefined;
  const signal = options?.signal;
  const timeMilli = options?.timeMilli ?? BigInt(Date.now());
  const forceJs = options?.forceJs ?? false;

  const bodyHash = sha3_256(txBodyBytes);
  const headerTail = buildHeaderTail(bodyHash, timeMilli);

  const useWasm = !forceJs && (await isWasmAvailable());

  const startTime = Date.now();
  let totalIterations = 0n;
  let nonce = 0n;

  while (true) {
    if (signal?.aborted) {
      throw new DOMException('Mining aborted', 'AbortError');
    }
    if (maxIterations !== undefined && totalIterations >= maxIterations) {
      throw new Error(
        `Mining exhausted: ${totalIterations} iterations without finding a valid nonce`
      );
    }

    const boundary = nextNonceBoundary(nonce);
    const chunkEnd = nonce + chunkSize < boundary ? nonce + chunkSize : boundary;

    const nonceBytes = writeMiniNumber(nonce);
    const nonceValueLen = nonceBytes.length - 2;
    const headerBuf = concat(nonceBytes, headerTail);

    // ── CRITICAL: WASM and JS are mutually exclusive per chunk ──────────────
    // When WASM returns null (no nonce in chunk), the chunk has been fully
    // scanned by WASM — we do NOT re-scan it with JS. Doing so would double
    // work and could incorrectly set source='wasm' on a JS-found nonce.
    let found: bigint | null;

    if (useWasm) {
      found = await mineChunkWasm(
        headerBuf.slice(), // WASM gets its own copy to avoid aliasing
        2,
        nonceValueLen,
        txnDifficulty,
        nonce,
        chunkEnd - nonce
      );
    } else {
      found = mineChunkJs(headerBuf, nonceValueLen, txnDifficulty, nonce, chunkEnd);
    }
    // ── End mutually exclusive section ───────────────────────────────────────

    if (found !== null) {
      const finalNonceBytes = writeMiniNumber(found);
      const finalHeader = concat(finalNonceBytes, headerTail);
      const txpowId = sha3_256(finalHeader);
      return {
        minedHeaderBytes: finalHeader,
        txpowId,
        nonce: found,
        elapsedMs: Date.now() - startTime,
        source: useWasm ? 'wasm' : 'js',
      };
    }

    totalIterations += chunkEnd - nonce;
    nonce = chunkEnd;

    await new Promise<void>(resolve => {
      if (typeof setImmediate !== 'undefined') {
        setImmediate(resolve);
      } else {
        setTimeout(resolve, 0);
      }
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mine a TxPoW locally by iterating the header nonce until
 *   SHA3-256( TxHeader ) < txnDifficulty
 *
 * In Node.js (main thread), delegates to a `worker_threads` Worker so the
 * event loop is never blocked. In browsers or Jest, runs in-process with
 * periodic `setImmediate`/`setTimeout(0)` yields between chunks.
 *
 * Uses the pre-compiled `miner.wasm` binary for inner-loop throughput when
 * available. Falls back to pure JS automatically when the binary is absent.
 *
 * @param txBodyBytes   Pre-serialized TxBody bytes (from serializeTxBody).
 * @param txnDifficulty 32-byte target. MUST be ≤ TX_POW_MIN_DIFFICULTY.
 * @param options       Chunk size, max iterations, abort signal, timeMilli override.
 */
export async function mineTxPoW(
  txBodyBytes: Uint8Array,
  txnDifficulty: Uint8Array,
  options?: MineOptions
): Promise<MineResult> {
  // ── Node.js: spawn a worker_threads Worker (keeps event loop unblocked) ──
  if (shouldUseNodeWorker(options)) {
    return mineTxPoWViaNodeWorker(txBodyBytes, txnDifficulty, options);
  }

  // ── Browser: spawn a Web Worker when the URL has been configured ──────────
  // The extension build (Task #114) calls setBrowserWorkerUrl() at startup.
  // Without a configured URL, mine falls back to in-process (setImmediate loop).
  if (
    !options?._skipWorker &&
    typeof process === 'undefined' &&         // not Node.js
    _browserWorkerUrl !== null
  ) {
    return mineTxPoWViaBrowserWorker(txBodyBytes, txnDifficulty, options);
  }

  // ── In-process fallback (browser without worker URL, or explicit skip) ────
  return mineTxPoWInProcess(txBodyBytes, txnDifficulty, options);
}
