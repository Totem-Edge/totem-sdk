/**
 * Deterministic parser/evaluator property tests.
 *
 * Random source must either parse or throw a controlled Error (never
 * TypeError/RangeError). Generated scripts must either return an EvalResult or
 * throw KissvmLimitError; no host exception escapes.
 */

import {
  evaluateScript,
  parseScript,
  KissvmLimitError,
} from '../index';
import type { CoinData, OutputData, ScriptWitness, TxContext } from '../index';

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

function pick<T>(rng: () => number, values: readonly T[]): T {
  return values[int(rng, 0, values.length - 1)];
}

function witness(): ScriptWitness {
  return { signatures: new Map() };
}

function ctx(): TxContext {
  const coin: CoinData = { amount: 100, tokenId: '0x00', coinId: '0xabc', address: '0xdeadbeef' };
  const out: OutputData = { address: '0xdeadbeef', amount: 100, tokenId: '0x00', keepState: false };
  return {
    block: 500,
    inputIndex: 0,
    inputs: [coin],
    outputs: [out],
    state: {},
    prevState: {},
    simulationMode: true,
    allowLegacyMastBranches: true,
  };
}

const ATOMS = ['0', '1', '2', '10', '1.5', '0xAB', 'TRUE', 'FALSE', 'STATE(0)', 'PREVSTATE(0)'];
const UNARY = ['NOT', 'ABS', 'INT', 'LEN'];
const BINARY = ['+', '-', '*', '%', 'EQ', 'NEQ', 'GT', 'LT', 'AND', 'OR', 'XOR'];

function expression(rng: () => number, depth: number): string {
  if (depth <= 0 || rng() < 0.35) return pick(rng, ATOMS);
  switch (int(rng, 0, 3)) {
    case 0:
      return `${pick(rng, UNARY)}(${expression(rng, depth - 1)})`;
    case 1:
      return `(${expression(rng, depth - 1)} ${pick(rng, BINARY)} ${expression(rng, depth - 1)})`;
    case 2:
      return `SHA3(${expression(rng, depth - 1)})`;
    default:
      return `IF ${expression(rng, depth - 1)} THEN ${expression(rng, depth - 1)} ELSE ${expression(rng, depth - 1)} ENDIF`;
  }
}

function script(rng: () => number): string {
  const e = expression(rng, 2);
  return pick(rng, [
    `RETURN ${e}`,
    `ASSERT ${e} RETURN TRUE`,
    `LET x = ${e} RETURN x`,
    `IF ${e} THEN RETURN TRUE ELSE RETURN FALSE ENDIF`,
    `RETURN (${e})`,
  ]);
}

const PARSE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789()+-*/%<>=!&|^~[]{},:; \n';

describe('KISSVM parser/evaluator properties', () => {
  it('never exposes TypeError/RangeError from random source', () => {
    const rng = mulberry32(0x5c71);
    for (let i = 0; i < 1000; i += 1) {
      const len = int(rng, 0, 120);
      let source = '';
      for (let j = 0; j < len; j += 1) source += pick(rng, PARSE_ALPHABET);
      try {
        parseScript(source);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error).not.toBeInstanceOf(TypeError);
        expect(error).not.toBeInstanceOf(RangeError);
      }
    }
  });

  it('evaluates 400 generated scripts without escaping host exceptions', () => {
    const rng = mulberry32(0xe7a1);
    for (let i = 0; i < 400; i += 1) {
      const source = script(rng);
      try {
        const result = evaluateScript(source, witness(), ctx());
        expect(typeof result.passed).toBe('boolean');
        expect(typeof result.success).toBe('boolean');
        expect(typeof result.instructionsUsed).toBe('number');
      } catch (error) {
        expect(error).toBeInstanceOf(KissvmLimitError);
      }
    }
  });
});
