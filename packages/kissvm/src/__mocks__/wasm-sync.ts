export function evaluateScriptWasm(_script: string, _witness: any, _txCtx: any): any {
  throw new Error('WASM not available in test environment');
}

export function parseScriptWasm(_source: string): any {
  throw new Error('WASM not available in test environment');
}
