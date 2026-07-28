/**
 * browser.worker.ts — Browser Web Worker entry point for TxPoW mining.
 *
 * This file is the Web Worker counterpart to node.worker.ts.
 * It is designed to be bundled by the extension's build system (webpack / vite)
 * as part of Task #114. It cannot be loaded directly from a CJS context.
 *
 * Usage (from the extension):
 *   import MinerWorker from '@totemsdk/txpow/dist/workers/browser.worker.js?worker';
 *   const worker = new MinerWorker();
 *   worker.postMessage({ txBodyBytes, txnDifficulty, wasmUrl, options });
 *   worker.onmessage = (e) => { const result: MineResult = e.data; };
 *
 * Communication protocol (mirrors node.worker.ts):
 *   Input  (onmessage e.data): BrowserWorkerInput  — serialized mining parameters
 *   Output (postMessage):      BrowserWorkerOutput — serialized MineResult or error
 *
 * WASM in the worker:
 *   The browser Web Worker runs in its own JS context, so `setWasmUrl()` called
 *   on the main thread does NOT carry over. Pass the WASM URL in the input
 *   message (`wasmUrl` field) so the worker can call `setWasmUrl()` before
 *   starting the mining loop. Without `wasmUrl`, the worker mines in pure JS.
 *
 * See mine.ts for details on the BigInt string encoding and Uint8Array [] encoding.
 */

/// <reference lib="webworker" />

import { mineTxPoWInProcess } from '../mine.js';
import { setWasmUrl } from '../mine-wasm.js';

interface BrowserWorkerInput {
  txBodyBytes: number[];
  txnDifficulty: number[];
  /** Browser WASM URL — set by calling setWasmUrl() before mining begins. */
  wasmUrl?: string;
  chunkSize?: number;
  maxIterations?: string;
  timeMilli?: string;
  forceJs?: boolean;
}

interface BrowserWorkerOutput {
  minedHeaderBytes?: number[];
  txpowId?: number[];
  nonce?: string;
  elapsedMs?: number;
  source?: 'wasm' | 'js';
  error?: string;
}

self.onmessage = async (e: MessageEvent<BrowserWorkerInput>): Promise<void> => {
  const input = e.data;

  // Configure WASM inside this worker's JS context before mining starts.
  // The main thread's setWasmUrl() call does not carry over to a Web Worker.
  if (input.wasmUrl) {
    setWasmUrl(input.wasmUrl);
  }

  try {
    const result = await mineTxPoWInProcess(
      new Uint8Array(input.txBodyBytes),
      new Uint8Array(input.txnDifficulty),
      {
        chunkSize: input.chunkSize,
        maxIterations:
          input.maxIterations !== undefined
            ? Number(input.maxIterations)
            : undefined,
        timeMilli:
          input.timeMilli !== undefined ? BigInt(input.timeMilli) : undefined,
        forceJs: input.forceJs,
        _skipWorker: true,
      }
    );

    const output: BrowserWorkerOutput = {
      minedHeaderBytes: Array.from(result.minedHeaderBytes),
      txpowId: Array.from(result.txpowId),
      nonce: result.nonce.toString(),
      elapsedMs: result.elapsedMs,
      source: result.source,
    };

    self.postMessage(output);
  } catch (err: unknown) {
    const output: BrowserWorkerOutput = {
      error: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(output);
  }
};
