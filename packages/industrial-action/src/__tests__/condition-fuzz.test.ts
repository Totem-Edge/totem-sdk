/**
 * Deterministic condition-boundary properties.
 *
 * The policy gate must match the documented operators and fail closed for
 * missing fields, unknown operators and throwing custom evaluators.
 */

import { evaluateConditions } from '../condition';
import type { Condition } from '../types';

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

function int(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

const NUMERIC_OPERATORS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'] as const;

function expected(operator: string, actual: unknown, value: unknown): boolean {
  switch (operator) {
    case 'eq': return actual === value;
    case 'neq': return actual !== value;
    case 'gt': return typeof actual === 'number' && typeof value === 'number' && actual > value;
    case 'gte': return typeof actual === 'number' && typeof value === 'number' && actual >= value;
    case 'lt': return typeof actual === 'number' && typeof value === 'number' && actual < value;
    case 'lte': return typeof actual === 'number' && typeof value === 'number' && actual <= value;
    case 'in': return Array.isArray(value) && value.includes(actual);
    case 'not_in': return Array.isArray(value) && !value.includes(actual);
    default: return false;
  }
}

describe('industrial condition boundaries', () => {
  it('matches the operator model for 500 generated numeric conditions', () => {
    const rng = mulberry32(0xc0d1);
    for (let i = 0; i < 500; i += 1) {
      const actual = int(rng, -100, 100);
      const value = int(rng, -100, 100);
      const operator = NUMERIC_OPERATORS[int(rng, 0, NUMERIC_OPERATORS.length - 1)];
      const condition: Condition = { type: 'parameter_range', field: 'x', operator, value };
      const result = evaluateConditions([condition], { x: actual }, {});
      expect(result.passed).toBe(expected(operator, actual, value));
    }
  });

  it('matches in/not_in and fails a missing field closed', () => {
    const rng = mulberry32(0x1c1);
    for (let i = 0; i < 200; i += 1) {
      const actual = int(rng, 0, 5);
      const value = Array.from({ length: int(rng, 0, 5) }, () => int(rng, 0, 5));
      const operator = rng() < 0.5 ? 'in' : 'not_in';
      const result = evaluateConditions([{ type: 'parameter_range', field: 'x', operator, value }], { x: actual }, {});
      expect(result.passed).toBe(expected(operator, actual, value));
    }
    expect(evaluateConditions([{ type: 'parameter_range', field: 'missing', operator: 'gt', value: 0 }], {}, {}).passed).toBe(false);
  });

  it('fails closed for an unknown operator and a throwing evaluator', () => {
    expect(
      evaluateConditions([{ type: 'parameter_range', field: 'x', operator: 'bogus' as never, value: 1 }], { x: 1 }, {}).passed,
    ).toBe(false);
    expect(
      evaluateConditions([{ type: 'custom', evaluate: () => { throw new Error('hostile'); } }], {}, {}).passed,
    ).toBe(false);
  });
});
