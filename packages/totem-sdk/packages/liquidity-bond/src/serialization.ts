import { LiquiditySerializationError } from './errors.js';

function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'bigint') return JSON.stringify({ __bigint: value.toString() });
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new LiquiditySerializationError('Cannot serialize NaN or Infinity');
    return JSON.stringify(value);
  }
  if (typeof value === 'function') throw new LiquiditySerializationError('Cannot serialize functions');
  if (typeof value === 'symbol') throw new LiquiditySerializationError('Cannot serialize symbols');
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (Array.isArray(value)) {
    const items = value.map((v) => canonicalJson(v));
    return `[${items.join(',')}]`;
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    const pairs = keys.map((k) => {
      const v = (value as Record<string, unknown>)[k];
      if (v === undefined) return null;
      return `${JSON.stringify(k)}:${canonicalJson(v)}`;
    }).filter((p): p is string => p !== null);
    return `{${pairs.join(',')}}`;
  }
  return JSON.stringify(value);
}

function bigIntReviver(_key: string, value: unknown): unknown {
  if (value && typeof value === 'object' && '__bigint' in value) {
    return BigInt((value as { __bigint: string }).__bigint);
  }
  return value;
}

export function serializeLiquidityBondState(state: unknown): string {
  return canonicalJson(state);
}

export function parseLiquidityBondState<T = unknown>(json: string): T {
  return JSON.parse(json, bigIntReviver) as T;
}

export function serializeLiquidityBondRecord(record: unknown): string {
  return canonicalJson(record);
}

export function parseLiquidityBondRecord<T = unknown>(json: string): T {
  return JSON.parse(json, bigIntReviver) as T;
}

export { canonicalJson };
