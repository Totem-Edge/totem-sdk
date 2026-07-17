export { evaluateScript } from './eval.js';
export { simulateSpend } from './simulate.js';
export { buildWitness } from './witness.js';
export { parseScript } from './parser.js';
export { KissvmLimitError, KissvmRuntimeError } from './errors.js';
export { sigdig } from './eval.js';

// WASM bridge (Rust-backed evaluator and parser)
export { evaluateScriptWasm, parseScriptWasm } from './wasm-sync.js';

export type {
  Value,
  EvalResult,
  ScriptWitness,
  CoinData,
  OutputData,
  TxContext,
  ASTNode,
} from './types.js';

export type { WitnessInput } from './witness.js';
