declare module '../rust/pkg/kissvm_wasm.js' {
  export function evaluate_script_wasm(script: string, witness: any, txCtx: any): any;
  export function parse_script_wasm(source: string): any;
}
