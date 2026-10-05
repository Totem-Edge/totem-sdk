import { sha3_256, concatBytes } from '@totemsdk/core';
import { evaluateScript } from './eval.js';
import type { EvalResult, ScriptWitness, CoinData, TxContext, OutputData } from './types.js';

/**
 * Compute a deterministic 32-byte txDigest from the transaction's observable
 * fields (block, inputs, outputs, state).  Used by simulateSpend when the
 * caller does not supply a pre-computed digest, ensuring SIGNEDBY/CHECKSIG
 * always perform real WOTS verification rather than presence-only checks.
 *
 * The encoding is intentionally simple and stable; it is NOT required to
 * match Minima's production digest format — its sole purpose is to give each
 * synthetic test transaction a unique, reproducible digest so that signature
 * witnesses can be deterministically pre-signed against it.
 */
function computeSimulationDigest(
  block: number,
  inputs: CoinData[],
  outputs: OutputData[],
  state: Record<number, string>,
): Uint8Array {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  // block
  const blkBuf = Buffer.alloc(4);
  blkBuf.writeUInt32BE(block, 0);
  parts.push(blkBuf);
  // inputs
  for (const c of inputs) {
    parts.push(enc.encode(String(c.coinId) + ':' + String(c.amount) + ':' + String(c.tokenId) + ':' + String(c.address)));
  }
  // outputs
  for (const o of outputs) {
    parts.push(enc.encode(String(o.address) + ':' + String(o.amount) + ':' + String(o.tokenId)));
  }
  // state
  const stateKeys = Object.keys(state).sort();
  for (const k of stateKeys) parts.push(enc.encode(k + '=' + state[Number(k)]));
  return sha3_256(concatBytes(...parts));
}

/**
 * simulateSpend — simulate a KISSVM coin-spend.
 *
 * Populates the evaluator context from `coinData` (used as the input coin at
 * inputIndex 0) unless the caller has already provided `txContext.inputs`.
 * This ensures @ADDRESS, @AMOUNT, @TOKENID, @COINAGE and @SCRIPT resolve
 * correctly during evaluation.
 *
 * Always computes (or forwards) a `txDigest` so SIGNEDBY/CHECKSIG perform
 * real WOTS signature verification.  Never uses simulationMode — callers
 * who need presence-only checks for script-logic unit tests must pass
 * `simulationMode: true` in `txContext` directly to `evaluateScript`.
 *
 * Returns a Promise so callers can uniformly await it even though the
 * evaluation itself is synchronous.
 */
export async function simulateSpend(
  scriptStr: string,
  coinData: CoinData,
  txContext: TxContext,
  witness?: ScriptWitness,
): Promise<EvalResult> {
  const w: ScriptWitness = witness ?? { signatures: new Map() };

  // Derive context: use coinData to populate inputs if the caller omitted them
  const inputs = txContext.inputs && txContext.inputs.length > 0
    ? txContext.inputs
    : [coinData];

  const outputs = txContext.outputs ?? [];

  // Always provide a txDigest so SIGNEDBY/CHECKSIG run real WOTS verification.
  // If the caller already computed one, honour it; otherwise derive it
  // deterministically from the observable transaction fields.
  const txDigest = txContext.txDigest ?? computeSimulationDigest(
    txContext.block,
    inputs,
    outputs,
    txContext.state ?? {},
  );

  const ctx: TxContext = {
    ...txContext,
    inputs,
    inputIndex: txContext.inputIndex ?? 0,
    outputs,
    txDigest,
    // simulationMode MUST NOT be set here — we always have a digest above
  };
  // Strip any simulationMode the caller may have accidentally forwarded
  delete (ctx as Partial<TxContext>).simulationMode;

  return evaluateScript(scriptStr, w, ctx);
}
