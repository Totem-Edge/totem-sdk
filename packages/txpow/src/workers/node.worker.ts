/**
 * node.worker.ts — Node.js worker_threads entry point for TxPoW mining.
 *
 * This file is compiled to `dist/workers/node.worker.js` and spawned by
 * `mineTxPoW()` in the main thread via `new Worker(workerPath, { workerData })`.
 *
 * Communication protocol:
 *   Input  (workerData): NodeWorkerInput  — serialized mining parameters
 *   Output (postMessage): NodeWorkerOutput — serialized MineResult or error
 *
 * BigInt values (nonce, timeMilli, maxIterations) are transmitted as strings
 * to avoid structured-clone limitations on older Node.js versions.
 * Uint8Arrays are transmitted as number[] for reliable structured-clone transfer.
 */

/* eslint-disable @typescript-eslint/no-var-requires */
const { workerData, parentPort } = require('worker_threads') as typeof import('worker_threads');
const { mineTxPoWInProcess } = require('../mine') as { mineTxPoWInProcess: typeof import('../mine').mineTxPoWInProcess };

interface NodeWorkerInput {
  txBodyBytes: number[];
  txnDifficulty: number[];
  chunkSize?: number;
  maxIterations?: string;
  timeMilli?: string;
  forceJs?: boolean;
}

interface NodeWorkerOutput {
  minedHeaderBytes?: number[];
  txpowId?: number[];
  nonce?: string;
  elapsedMs?: number;
  source?: 'wasm' | 'js';
  error?: string;
}

async function run(): Promise<void> {
  const input = workerData as NodeWorkerInput;

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

    const output: NodeWorkerOutput = {
      minedHeaderBytes: Array.from(result.minedHeaderBytes),
      txpowId: Array.from(result.txpowId),
      nonce: result.nonce.toString(),
      elapsedMs: result.elapsedMs,
      source: result.source,
    };

    parentPort?.postMessage(output);
  } catch (err: unknown) {
    const output: NodeWorkerOutput = {
      error: err instanceof Error ? err.message : String(err),
    };
    parentPort?.postMessage(output);
  }
}

run();
