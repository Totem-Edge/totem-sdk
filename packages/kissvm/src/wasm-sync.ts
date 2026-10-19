/**
 * Synchronous WASM bridge for @totemsdk/kissvm.
 *
 * Delegates script parsing and evaluation to Rust/WASM.
 * Falls back to the TypeScript implementation if WASM is unavailable.
 */

import type { ScriptWitness } from './types.js';
import { toNodeScript } from '@totemsdk/core';
import type { TreeSignature } from '@totemsdk/core';

let evaluate_script_wasm: any;
let parse_script_wasm: any;

try {
  const wasm = require('../rust/pkg/kissvm_wasm.js');
  evaluate_script_wasm = wasm.evaluate_script_wasm;
  parse_script_wasm = wasm.parse_script_wasm;
} catch {
  // WASM not available — TypeScript fallback will be used
}

/**
 * Convert a canonical Minima `TreeSignature` into the shape the Rust VM's
 * serde bridge deserializes (`totemsdk_core_wasm::treekey::TreeSignature`).
 * Byte fields become plain number arrays; `mmrProof.blockTime` is dropped (the
 * Rust proof has no block time and serde ignores unknown fields).
 */
export function treeSignatureToWasm(sig: TreeSignature): unknown {
  return {
    proofs: sig.proofs.map((p) => ({
      leafPubkey: Array.from(p.leafPubkey),
      signature: Array.from(p.signature),
      mmrProof: {
        chunks: (p.mmrProof?.chunks ?? []).map((c: any) => ({
          isLeft: !!c.isLeft,
          mmrData: {
            data: Array.from(c.mmrData.data),
            value: Number((c.mmrData as any).value ?? 0),
          },
        })),
      },
    })),
  };
}

/**
 * Convert a TS `ScriptWitness` (Map keyed by signer root key) into the Rust VM
 * witness object. Flat WOTS entries go in `signatures`; canonical tree
 * signatures (RFC-009) go in `treeSignatures`, keyed by root public key — the
 * identity `SIGNEDBY`/`MULTISIG` match against (RFC-048).
 */
export function toWasmWitness(witness: ScriptWitness): unknown {
  const signatures: Record<string, number[]> = {};
  const treeSignatures: Record<string, unknown> = {};
  for (const [key, value] of witness.signatures ?? new Map()) {
    if (value instanceof Uint8Array) signatures[key] = Array.from(value);
    else treeSignatures[key] = treeSignatureToWasm(value as TreeSignature);
  }
  const out: Record<string, unknown> = { signatures };
  if (Object.keys(treeSignatures).length > 0) out.treeSignatures = treeSignatures;
  if (witness.preimages) out.preimages = Object.fromEntries(witness.preimages);
  return out;
}

export function evaluateScriptWasm(
  script: string,
  witness: ScriptWitness | Record<string, unknown>,
  txCtx: any,
): any {
  if (!evaluate_script_wasm) {
    throw new Error('WASM evaluator not available — use the TypeScript evaluator instead');
  }
  // Canonical TS witnesses (Map-valued) are converted; pre-shaped wasm witness
  // objects pass through unchanged.
  const w =
    (witness as ScriptWitness)?.signatures instanceof Map
      ? toWasmWitness(witness as ScriptWitness)
      : witness;
  return evaluate_script_wasm(toNodeScript(script), w, txCtx);
}

export function parseScriptWasm(source: string): any {
  if (!parse_script_wasm) {
    throw new Error('WASM parser not available — use the TypeScript parser instead');
  }
  return parse_script_wasm(source);
}
