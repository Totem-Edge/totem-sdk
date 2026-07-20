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

export function matchConstraints(
  action: ActionIntent,
  constraints: MandateConstraint[],
): boolean {
  for (const c of constraints) {
    const actual = action.constraints?.[c.field];
    if (actual === undefined) return false;

    switch (c.operator) {
      case 'eq':
        if (actual !== c.value) return false;
        break;
      case 'lt':
        if (Number(actual) >= Number(c.value)) return false;
        break;
      case 'lte':
        if (Number(actual) > Number(c.value)) return false;
        break;
      case 'gt':
        if (Number(actual) <= Number(c.value)) return false;
        break;
      case 'gte':
        if (Number(actual) < Number(c.value)) return false;
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
