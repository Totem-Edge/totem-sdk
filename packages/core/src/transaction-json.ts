/**
 * Compatibility adapters for the legacy JSON transaction surface.
 *
 * The WASM bindings are retained as `*Wasm` exports, but the public
 * `serializeTransaction` / `precomputeTransactionCoinID` names route through
 * the TypeScript implementation. This avoids the WASM serializer crash on
 * token+state outputs and the incorrect coin-ID precompute semantics.
 */

import { hexToBytes, bytesToHex } from './Streamable.js';
import {
  deserializeTransaction,
  parseDecimalToMiniNumber,
  precomputeTransactionCoinID as precomputeObject,
  serializeTransaction as serializeObject,
  type MinimaCoin,
  type MinimaToken,
  type MinimaTransaction,
  type StateVariable,
} from './transaction.js';
import { writeMiniData, writeMiniNumber, concat } from './Streamable.js';
import { sha3_256 } from './wasm-sync.js';

interface JsonStateVariable {
  port: number;
  svtype?: string;
  type?: string;
  data: string;
}

interface JsonToken {
  coinid?: string;
  scale?: string;
  totalamount?: string;
  name?: string;
  script?: string;
  created?: string;
}

interface JsonCoin {
  coinid?: string;
  address: string;
  amount: string;
  tokenid?: string;
  storestate?: boolean;
  state?: JsonStateVariable[];
  mmrentry?: string;
  spent?: boolean;
  created?: string;
  token?: JsonToken | null;
}

interface JsonTransaction {
  inputs?: JsonCoin[];
  outputs?: JsonCoin[];
  state?: JsonStateVariable[];
  linkhash?: string;
}

function bytes(value: string | undefined): Uint8Array {
  if (!value || value === '0x') return new Uint8Array([0]);
  return hexToBytes(value);
}

function evenHex(value: string): string {
  const raw = value.trim().replace(/^0x/i, '')
  return '0x' + (raw.length % 2 === 0 ? raw : `0${raw}`)
}

function stateVariables(input: JsonStateVariable[] | undefined): StateVariable[] {
  return (input ?? []).map((sv) => {
    const rawType = (sv.svtype ?? sv.type ?? '').toLowerCase();
    if (rawType === 'bool' || rawType === 'boolean') {
      return { port: sv.port, type: 'bool', value: sv.data === 'true' || sv.data === '1' || sv.data === '01' };
    }
    if (rawType === 'number') return { port: sv.port, type: 'number', value: sv.data };
    if (rawType === 'string') return { port: sv.port, type: 'string', value: sv.data };
    return { port: sv.port, type: 'hex', value: evenHex(sv.data) };
  });
}

function token(input: JsonToken | null | undefined): MinimaToken | null {
  if (!input) return null
  const parsed = parseDecimalToMiniNumber(input.totalamount ?? '0')
  return {
    coinId: bytes(input.coinid),
    scale: Number(input.scale ?? 0),
    totalAmount: parsed.unscaledValue,
    totalAmountScale: parsed.scale,
    name: new TextEncoder().encode(input.name ?? ''),
    script: bytes(input.script),
    created: BigInt(input.created ?? '0'),
  }
}

function coin(input: JsonCoin): MinimaCoin {
  return {
    coinId: bytes(input.coinid),
    address: bytes(input.address),
    amount: input.amount,
    tokenId: bytes(input.tokenid),
    token: token(input.token),
    storeState: input.storestate ?? false,
    state: stateVariables(input.state),
    mmrEntryNumber: BigInt(input.mmrentry ?? '0'),
    spent: input.spent ?? false,
    created: BigInt(input.created ?? '0'),
  }
}

/** Convert the legacy JSON transaction shape into the TS object shape. */
export function minimaTransactionFromJson(json: string): MinimaTransaction {
  const parsed = JSON.parse(json) as JsonTransaction
  return {
    inputs: (parsed.inputs ?? []).map(coin),
    outputs: (parsed.outputs ?? []).map(coin),
    state: stateVariables(parsed.state),
    linkHash: bytes(parsed.linkhash ?? '0x00'),
  }
}

/** Public serializer: accepts the TS object or the legacy JSON string. */
export function serializeTransaction(tx: MinimaTransaction | string): Uint8Array {
  const value = typeof tx === 'string' ? minimaTransactionFromJson(tx) : tx
  return serializeObject(value)
}

/** Coin-ID rollover: SHA3(MiniData(coinId) || MiniNumber(index)). */
export function rollCoinId(coinId: Uint8Array, outputIndex = 0): Uint8Array {
  return sha3_256(concat(writeMiniData(coinId), writeMiniNumber(BigInt(outputIndex), 0)))
}

export function precomputeTransactionCoinID(tx: MinimaTransaction): void
export function precomputeTransactionCoinID(tx: Uint8Array | string, outputIndex?: number): Uint8Array
export function precomputeTransactionCoinID(
  tx: MinimaTransaction | Uint8Array | string,
  outputIndex = 0,
): void | Uint8Array {
  if (typeof tx === 'object' && !(tx instanceof Uint8Array)) {
    precomputeObject(tx)
    return
  }
  if (typeof tx === 'string') {
    const value = minimaTransactionFromJson(tx)
    precomputeObject(value)
    return value.outputs[outputIndex]?.coinId ?? new Uint8Array()
  }
  // Legacy callers pass either a 32-byte input coin ID (rollover) or serialized
  // transaction bytes (output coin ID). Prefer the transaction interpretation,
  // but fall back to coin-ID rollover for a bare 32-byte value.
  try {
    const value = deserializeTransaction(tx)
    if (value.inputs.length > 0) {
      precomputeObject(value)
      return value.outputs[outputIndex]?.coinId ?? new Uint8Array()
    }
  } catch {
    // not a serialized transaction
  }
  return rollCoinId(tx, outputIndex)
}

export { bytesToHex }
