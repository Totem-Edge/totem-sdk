/**
 * Built-in transaction variables — TS/Rust parity.
 *
 * The Rust/WASM evaluator mirrors Minima's node VM and is the engine that runs
 * on-chain checks, so a built-in the TypeScript evaluator understands but Rust
 * does not is a covenant that passes in tests and fails on the node. That is not
 * hypothetical: the factory per-party escape asserts `@TOTOUT EQ 1` for a
 * whole-share exit, and `@TOTOUT` was missing from `resolve_builtin`.
 *
 * Every case here runs the same script through both evaluators and asserts they
 * agree *and* produce the documented answer.
 */

import { evaluateScript } from '@totemsdk/kissvm';
import type { TxContext } from '@totemsdk/kissvm';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const WASM_ENTRY = require('node:path').join(
  __dirname,
  '../../../../../packages/kissvm/rust/pkg-node/kissvm_wasm.js',
);

let wasm: {
  evaluate_script_wasm(script: string, witness: unknown, txCtx: unknown): {
    passed?: boolean;
    success?: boolean;
    error?: string;
  };
} | undefined;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  wasm = require(WASM_ENTRY) as typeof wasm;
} catch {
  wasm = undefined;
}

function txCtx(overrides: Partial<TxContext> = {}): TxContext {
  return {
    block: 1_000,
    inputIndex: 0,
    inputs: [{ amount: 1_000, tokenId: '0x00', coinId: '0x' + 'c1'.repeat(32), address: '0xf1' }],
    outputs: [{ address: '0xf1', amount: 1_000, tokenId: '0x00', keepState: false }],
    state: {},
    prevState: {},
    ...overrides,
  };
}

function tsPassed(script: string, ctx: TxContext): boolean {
  return evaluateScript(script, { signatures: new Map() }, ctx).passed === true;
}

function wasmPassed(script: string, ctx: TxContext): boolean {
  if (!wasm) throw new Error('Rust/WASM evaluator is not built (run `npm run build:wasm` in packages/kissvm)');
  const result = wasm.evaluate_script_wasm(script, { signatures: {} }, ctx);
  return result.passed === true || result.success === true;
}

interface Case {
  name: string;
  script: string;
  ctx: TxContext;
  expected: boolean;
}

const twoOutputs = txCtx({
  outputs: [
    { address: '0xf1', amount: 500, tokenId: '0x00', keepState: false },
    { address: '0xf2', amount: 500, tokenId: '0x00', keepState: true },
  ],
});

const cases: Case[] = [
  {
    name: '@TOTIN reads the input count',
    script: 'ASSERT @TOTIN EQ 1\nRETURN TRUE',
    ctx: txCtx(),
    expected: true,
  },
  {
    name: '@TOTIN rejects a wrong count',
    script: 'ASSERT @TOTIN EQ 2\nRETURN TRUE',
    ctx: txCtx(),
    expected: false,
  },
  {
    name: '@TOTOUT reads the output count',
    script: 'ASSERT @TOTOUT EQ 2\nRETURN TRUE',
    ctx: twoOutputs,
    expected: true,
  },
  {
    name: '@TOTOUT rejects a wrong count',
    script: 'ASSERT @TOTOUT EQ 1\nRETURN TRUE',
    ctx: twoOutputs,
    expected: false,
  },
  {
    name: '@COINID reads the spent coin id',
    script: `ASSERT @COINID EQ 0x${'c1'.repeat(32)}\nRETURN TRUE`,
    ctx: txCtx(),
    expected: true,
  },
  {
    name: '@COINID rejects a different coin',
    script: `ASSERT @COINID EQ 0x${'d2'.repeat(32)}\nRETURN TRUE`,
    ctx: txCtx(),
    expected: false,
  },
  {
    name: '@CREATED reads the coin creation block',
    script: 'ASSERT @CREATED EQ 900\nRETURN TRUE',
    ctx: txCtx({ inputs: [{ amount: 1_000, tokenId: '0x00', coinId: '0xc1', address: '0xf1', coinCreatedBlock: 900 }] }),
    expected: true,
  },
  {
    name: '@BLOCKMILLI reads the millisecond clock when supplied',
    script: 'ASSERT @BLOCKMILLI EQ 1000.5\nRETURN TRUE',
    ctx: txCtx({ blockMilli: 1_000.5 }),
    expected: true,
  },
  {
    name: '@BLOCKMILLI fails closed when the clock is absent',
    script: 'RETURN @BLOCKMILLI GT 0',
    ctx: txCtx(),
    expected: false,
  },
  {
    name: 'whole-share escape covenant: one output satisfies @TOTOUT EQ 1',
    script: 'ASSERT @TOTOUT EQ 1\nRETURN TRUE',
    ctx: txCtx(),
    expected: true,
  },
  {
    name: 'whole-share escape covenant: a state-carrying successor violates @TOTOUT EQ 1',
    script: 'ASSERT @TOTOUT EQ 1\nRETURN TRUE',
    ctx: twoOutputs,
    expected: false,
  },
];

describe('built-in variable parity (TypeScript)', () => {
  for (const testCase of cases) {
    it(`${testCase.name}: ${testCase.expected ? 'executes' : 'is rejected'}`, () => {
      expect({ name: testCase.name, passed: tsPassed(testCase.script, testCase.ctx) })
        .toEqual({ name: testCase.name, passed: testCase.expected });
    });
  }
});

const wasmSuite = wasm ? describe : describe.skip;

wasmSuite('built-in variable parity (Rust/WASM)', () => {
  for (const testCase of cases) {
    it(`${testCase.name}: agrees with TypeScript`, () => {
      expect({ name: testCase.name, passed: wasmPassed(testCase.script, testCase.ctx) })
        .toEqual({ name: testCase.name, passed: tsPassed(testCase.script, testCase.ctx) });
      expect(wasmPassed(testCase.script, testCase.ctx)).toBe(testCase.expected);
    });
  }
});
