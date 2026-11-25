/**
 * stateVariables.ts — shared parsing for state-variable arrays supplied by the
 * send UI or a dApp approval URL.
 */
import type { StateVariable } from '@totemsdk/core';

const TYPES = new Set(['bool', 'number', 'hex', 'string']);

/**
 * Parse a JSON array of `{ port, type, value }` state variables.
 *
 * Returns `undefined` for an empty string so callers can omit the field.
 * Throws before any signing work when the payload is malformed.
 */
export function parseStateVariablesJson(
  raw: string,
  label: string,
): StateVariable[] | undefined {
  if (!raw.trim()) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${label} must be valid JSON`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`${label} must be an array of { port, type, value }`);
  }

  return parsed.map((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`${label}[${index}] must be an object`);
    }
    const candidate = entry as { port?: unknown; type?: unknown; value?: unknown };
    if (!Number.isInteger(candidate.port) || (candidate.port as number) < 0 || (candidate.port as number) > 255) {
      throw new Error(`${label}[${index}].port must be an integer 0-255`);
    }
    if (typeof candidate.type !== 'string' || !TYPES.has(candidate.type)) {
      throw new Error(`${label}[${index}].type must be one of bool, number, hex, string`);
    }
    if (candidate.value === undefined) {
      throw new Error(`${label}[${index}].value is required`);
    }

    const type = candidate.type as StateVariable['type'];
    let value = candidate.value;
    switch (type) {
      case 'bool':
        if (typeof value !== 'boolean' && typeof value !== 'string') {
          throw new Error(`${label}[${index}].value must be a boolean`);
        }
        break;
      case 'number':
        if (typeof value === 'number') {
          if (!Number.isFinite(value)) throw new Error(`${label}[${index}].value must be finite`);
          value = String(value);
        } else if (typeof value !== 'string') {
          throw new Error(`${label}[${index}].value must be a number or numeric string`);
        }
        break;
      case 'hex':
      case 'string':
        if (typeof value !== 'string') {
          throw new Error(`${label}[${index}].value must be a string`);
        }
        break;
    }

    return {
      port: candidate.port as number,
      type,
      value: value as StateVariable['value'],
    };
  });
}
