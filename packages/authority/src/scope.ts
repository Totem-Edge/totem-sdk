import type { ActionIntent, MandateConstraint } from './types.js';

export function matchScope(action: string, scope: string): boolean {
  if (scope === '*') return true;
  if (action === scope) return true;

  const aParts = action.split(':');
  const sParts = scope.split(':');

  let ai = 0;
  let si = 0;
  while (ai < aParts.length && si < sParts.length) {
    if (sParts[si] === '*') {
      if (si === sParts.length - 1) return true;
      si++;
      const need = aParts.length - (sParts.length - si);
      if (need < ai) return false;
      ai = need;
      continue;
    }
    if (aParts[ai] !== sParts[si]) return false;
    ai++;
    si++;
  }

  return ai === aParts.length && si === sParts.length;
}

/**
 * Resolve a constraint field against an action intent.
 *
 * Supports:
 *  - top-level action fields (`target`, `principal`, `agent`, `action`, `nonce`);
 *  - flat constraint keys (`action.constraints[field]`);
 *  - dotted nested paths into the constraint map (`payload.foo` → `constraints.payload.foo`).
 *
 * This lets governance-emitted constraints such as `target` and `payload.foo`
 * match without the caller manually flattening them into a single map.
 */
export function resolveActionField(action: ActionIntent, field: string): unknown {
  if (field === 'action') return action.action;
  if (field === 'principal') return action.principal;
  if (field === 'agent') return action.agent;
  if (field === 'target') return action.target;
  if (field === 'nonce') return action.nonce;

  const constraints = action.constraints;
  if (constraints === undefined) return undefined;

  if (Object.prototype.hasOwnProperty.call(constraints, field)) {
    return constraints[field];
  }

  if (field.includes('.')) {
    let current: unknown = constraints;
    for (const part of field.split('.')) {
      if (current === null || typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  }

  return undefined;
}

function compareNumeric(actual: unknown, value: unknown, operator: 'lt' | 'lte' | 'gt' | 'gte'): boolean {
  let a: bigint | undefined;
  let b: bigint | undefined;

  if (typeof actual === 'bigint') a = actual;
  else if (typeof actual === 'string') try { a = BigInt(actual); } catch {}
  else if (typeof actual === 'number') a = BigInt(actual);

  if (typeof value === 'bigint') b = value;
  else if (typeof value === 'string') try { b = BigInt(value); } catch {}
  else if (typeof value === 'number') b = BigInt(value);

  if (a !== undefined && b !== undefined) {
    switch (operator) {
      case 'lt':  return a < b;
      case 'lte': return a <= b;
      case 'gt':  return a > b;
      case 'gte': return a >= b;
    }
  }

  const an = Number(actual);
  const bn = Number(value);
  switch (operator) {
    case 'lt':  return an < bn;
    case 'lte': return an <= bn;
    case 'gt':  return an > bn;
    case 'gte': return an >= bn;
  }
}

export function matchConstraints(
  action: ActionIntent,
  constraints: MandateConstraint[],
): boolean {
  for (const c of constraints) {
    const actual = resolveActionField(action, c.field);
    if (actual === undefined) return false;

    switch (c.operator) {
      case 'eq':
        if (actual !== c.value) return false;
        break;
      case 'lt':
        if (!compareNumeric(actual, c.value, 'lt')) return false;
        break;
      case 'lte':
        if (!compareNumeric(actual, c.value, 'lte')) return false;
        break;
      case 'gt':
        if (!compareNumeric(actual, c.value, 'gt')) return false;
        break;
      case 'gte':
        if (!compareNumeric(actual, c.value, 'gte')) return false;
        break;
      case 'in': {
        const arr = c.value as unknown[];
        if (Array.isArray(actual)) {
          if (!actual.some((a: unknown) => arr.includes(a))) return false;
        } else {
          if (!arr.includes(actual)) return false;
        }
        break;
      }
      case 'not_in': {
        const arr = c.value as unknown[];
        if (Array.isArray(actual)) {
          if (actual.some((a: unknown) => arr.includes(a))) return false;
        } else {
          if (arr.includes(actual)) return false;
        }
        break;
      }
      default:
        return false;
    }
  }
  return true;
}
