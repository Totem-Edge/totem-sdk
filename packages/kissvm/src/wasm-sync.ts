/**
 * Synchronous WASM bridge for @totemsdk/kissvm.
 *
 * Delegates script parsing and evaluation to Rust/WASM.
 * Falls back to the TypeScript implementation if WASM is unavailable.
 */

let evaluate_script_wasm: any;
let parse_script_wasm: any;

try {
  const wasm = require('../rust/pkg/kissvm_wasm.js');
  evaluate_script_wasm = wasm.evaluate_script_wasm;
  parse_script_wasm = wasm.parse_script_wasm;
} catch {
  // WASM not available — TypeScript fallback will be used
}

export function evaluateScriptWasm(
  script: string,
  witness: any,
  txCtx: any,
): any {
  if (!evaluate_script_wasm) {
    throw new Error('WASM evaluator not available — use the TypeScript evaluator instead');
  }
  return evaluate_script_wasm(script, witness, txCtx);
}

export function parseScriptWasm(source: string): any {
  if (!parse_script_wasm) {
    throw new Error('WASM parser not available — use the TypeScript parser instead');
  }
  return parse_script_wasm(source);
}
