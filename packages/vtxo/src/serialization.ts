import { OmniaVtxo, OmniaVtxoPool } from './types.js';

const BIGINT_PREFIX = '__bigint__:';

function replacer(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') {
    return `${BIGINT_PREFIX}${value.toString()}`;
  }
  return value;
}

function reviver(_key: string, value: unknown): unknown {
  if (typeof value === 'string' && value.startsWith(BIGINT_PREFIX)) {
    return BigInt(value.slice(BIGINT_PREFIX.length));
  }
  return value;
}

export function serializeVtxo(vtxo: OmniaVtxo): string {
  return JSON.stringify(vtxo, replacer);
}

export function deserializeVtxo(json: string): OmniaVtxo {
  return JSON.parse(json, reviver) as OmniaVtxo;
}

export function serializePool(pool: OmniaVtxoPool): string {
  return JSON.stringify(pool, replacer);
}

export function deserializePool(json: string): OmniaVtxoPool {
  return JSON.parse(json, reviver) as OmniaVtxoPool;
}
