export function evaluate_script_wasm(_script: string, _witness: any, _txCtx: any): any {
  throw new Error('WASM not available in test environment');
}

export function parse_script_wasm(_source: string): any {
  throw new Error('WASM not available in test environment');
}
