/**
 * Synchronous WASM bridge for @totemsdk/kissvm.
 *
 * Delegates script parsing and evaluation to Rust/WASM.
 * Falls back to the TypeScript implementation if WASM is unavailable.
 */

import {
  evaluate_script_wasm,
  parse_script_wasm,
} from '../rust/pkg/kissvm_wasm.js';

export function evaluateScriptWasm(
  script: string,
  witness: any,
  txCtx: any,
): any {
  return evaluate_script_wasm(script, witness, txCtx);
}

export function parseScriptWasm(source: string): any {
  return parse_script_wasm(source);
}
