import type { ProgramTransition } from './types.js';

type TransitionScalar = string | bigint | boolean;

function canonicalScalar(value: unknown, path: string): TransitionScalar {
  if (typeof value === 'string' || typeof value === 'bigint' || typeof value === 'boolean') return value;
  throw new Error(`Invalid ProgramTransition ${path}: expected string, bigint, or boolean`);
}

function canonicalRecord<T extends TransitionScalar>(
  record: Record<string, unknown> | undefined,
  path: string,
): Record<string, T> | undefined {
  if (record === undefined) return undefined;
  if (record === null || typeof record !== 'object' || Array.isArray(record)) {
    throw new Error(`Invalid ProgramTransition ${path}: expected object`);
  }
  const out: Record<string, T> = {};
  for (const key of Object.keys(record).sort()) {
    out[key] = canonicalScalar(record[key], `${path}.${key}`) as T;
  }
  return out;
}

function canonicalStringRecord(
  record: Record<string, unknown> | undefined,
  path: string,
): Record<string, string> | undefined {
  if (record === undefined) return undefined;
  if (record === null || typeof record !== 'object' || Array.isArray(record)) {
    throw new Error(`Invalid ProgramTransition ${path}: expected object`);
  }
  const out: Record<string, string> = {};
  for (const key of Object.keys(record).sort()) {
    const value = record[key];
    if (typeof value !== 'string') {
      throw new Error(`Invalid ProgramTransition ${path}.${key}: expected string`);
    }
    out[key] = value;
  }
  return out;
}

export function canonicalizeProgramTransition(
  transition?: ProgramTransition,
): ProgramTransition | undefined {
  if (transition === undefined) return undefined;
  if (!transition || typeof transition !== 'object' || Array.isArray(transition)) {
    throw new Error('Invalid ProgramTransition: expected object');
  }
  if (typeof transition.action !== 'string' || transition.action.length === 0) {
    throw new Error('Invalid ProgramTransition action: expected non-empty string');
  }

  const canonical: ProgramTransition = { action: transition.action };
  const inputs = canonicalRecord(transition.inputs, 'inputs');
  if (inputs && Object.keys(inputs).length > 0) canonical.inputs = inputs;
  const witness = canonicalStringRecord(transition.witness, 'witness');
  if (witness && Object.keys(witness).length > 0) canonical.witness = witness;
  const metadata = canonicalStringRecord(transition.metadata, 'metadata');
  if (metadata && Object.keys(metadata).length > 0) canonical.metadata = metadata;
  return canonical;
}

function canonicalJsonValue(value: unknown): string {
  if (typeof value === 'bigint') return JSON.stringify({ __bigint: value.toString() });
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJsonValue).join(',')}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).sort().map(k => `${JSON.stringify(k)}:${canonicalJsonValue(obj[k])}`).join(',')}}`;
}

export function serializeProgramTransition(transition: ProgramTransition): string {
  return canonicalJsonValue(canonicalizeProgramTransition(transition));
}
