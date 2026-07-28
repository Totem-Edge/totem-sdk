import type { SpendableCoin } from './adapters.js';
import type { CoinSelectionOptions, CoinSelectionResult } from './coin-selection.js';

let wasmModule: any = null;
let wasmInitialized = false;

async function initWasm(): Promise<any> {
  if (wasmInitialized) return wasmModule;
  try {
    wasmModule = await import('../rust/pkg/tx_builder_wasm.js');
    await wasmModule.default();
    wasmInitialized = true;
    return wasmModule;
  } catch {
    return null;
  }
}

export async function selectCoinsWasm(
  coins: SpendableCoin[],
  options: CoinSelectionOptions,
  excludedAddresses: string[] = []
): Promise<CoinSelectionResult> {
  const wasm = await initWasm();
  if (!wasm) {
    throw new Error('WASM module not available');
  }
  return wasm.select_coins_wasm(coins, options, excludedAddresses);
}

export async function orderCoinsByAmountWasm(coins: SpendableCoin[]): Promise<SpendableCoin[]> {
  const wasm = await initWasm();
  if (!wasm) {
    throw new Error('WASM module not available');
  }
  return wasm.order_coins_by_amount_wasm(coins);
}

export async function sha3_256_hexWasm(data: Uint8Array): Promise<string> {
  const wasm = await initWasm();
  if (!wasm) {
    throw new Error('WASM module not available');
  }
  return wasm.sha3_256_hex_wasm(data);
}

export async function computeMultisigAddressWasm(config: {
  type: '2of2' | 'mofn';
  threshold: number;
  publicKeys: string[];
  ownPublicKey: string;
  address?: string;
}): Promise<{ address: string; scriptHash: string }> {
  const wasm = await initWasm();
  if (!wasm) {
    throw new Error('WASM module not available');
  }
  return wasm.compute_multisig_address_wasm({
    type: config.type,
    threshold: config.threshold,
    publicKeys: config.publicKeys,
    ownPublicKey: config.ownPublicKey,
    address: config.address,
  });
}

export async function recomputeDigestWasm(transactionHex: string): Promise<string> {
  const wasm = await initWasm();
  if (!wasm) {
    throw new Error('WASM module not available');
  }
  return wasm.recompute_digest_wasm(transactionHex);
}

export async function addDecimalStringsWasm(a: string, b: string): Promise<string> {
  const wasm = await initWasm();
  if (!wasm) {
    throw new Error('WASM module not available');
  }
  return wasm.add_decimal_strings_wasm(a, b);
}

export async function subtractDecimalStringsWasm(a: string, b: string): Promise<string> {
  const wasm = await initWasm();
  if (!wasm) {
    throw new Error('WASM module not available');
  }
  return wasm.subtract_decimal_strings_wasm(a, b);
}

export async function compareDecimalWasm(a: string, b: string): Promise<number> {
  const wasm = await initWasm();
  if (!wasm) {
    throw new Error('WASM module not available');
  }
  return wasm.compare_decimal_wasm(a, b);
}

export async function isPositiveWasm(value: string): Promise<boolean> {
  const wasm = await initWasm();
  if (!wasm) {
    throw new Error('WASM module not available');
  }
  return wasm.is_positive_wasm(value);
}
