/**
 * OMN-064 — CHECKSIG parity, measured against the reference implementation.
 *
 * Reference (`org.minima.kissvm.functions.sigs.CHECKSIG`):
 *   CHECKSIG(publickey data signature) → TreeKey.verify(data, signature)
 *
 * Exactly three parameters, HEX operands, no witness and no transaction digest.
 *
 * This suite runs the same fixtures through:
 *   1. the TypeScript evaluator with the *real* core (no crypto mock);
 *   2. the Rust/WASM evaluator built from `packages/kissvm/rust`.
 *
 * Tree signatures are the on-chain form. The Rust leg cannot deserialize them
 * yet (core-wasm has no byte reader), so those fixtures are marked
 * `pending-tree-signature` and asserted to diverge *explicitly* — the suite
 * fails if the divergence silently disappears or changes shape.
 */

import { buildChecksigFixtures, type ChecksigFixture } from '../../../../fixtures/kissvm/checksig-fixtures';
import { evaluateScript } from '@totemsdk/kissvm';
import type { TxContext } from '@totemsdk/kissvm';

// The nodejs-target artifact is a CommonJS module; the bundler artifact that
// `wasm-sync` requires cannot be loaded under Node. Resolve by absolute path so
// the repo-wide `\.js` moduleNameMapper does not rewrite it.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const WASM_ENTRY = require('node:path').join(
  __dirname,
  '../../../../../packages/kissvm/rust/pkg-node/kissvm_wasm.js',
);
// The artifact is gitignored; a fresh checkout must build it
// (`npm run build:wasm`). Missing it skips only the cross-evaluator leg, and
// CI builds it in the dedicated parity job so the leg always runs there.
let wasm: {
  evaluate_script_wasm(script: string, witness: unknown, txCtx: unknown): {
    passed?: boolean;
    success?: boolean;
    error?: string;
    trace?: string[];
  };
} | undefined;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  wasm = require(WASM_ENTRY) as typeof wasm;
} catch {
  wasm = undefined;
}

function txCtx(): TxContext {
  return {
    block: 1_000,
    inputIndex: 0,
    inputs: [{ amount: 1, tokenId: '0x00', coinId: '0xc1', address: '0xf1' }],
    outputs: [{ address: '0xf1', amount: 1, tokenId: '0x00', keepState: false }],
    state: {},
    prevState: {},
  };
}

function tsOutcome(fixture: ChecksigFixture): { passed: boolean; error?: string } {
  const result = evaluateScript(fixture.script, { signatures: new Map() }, txCtx());
  return { passed: result.passed === true, ...(result.error ? { error: result.error } : {}) };
}

function wasmOutcome(fixture: ChecksigFixture): { passed: boolean; error?: string } {
  if (!wasm) throw new Error('Rust/WASM evaluator is not built (run `npm run build:wasm` in packages/kissvm)');
  const result = wasm.evaluate_script_wasm(
    fixture.script,
    { signatures: {}, ...fixture.witness },
    txCtx(),
  );
  return {
    passed: result.passed === true || result.success === true,
    ...(result.error ? { error: result.error } : {}),
  };
}

const fixtures = buildChecksigFixtures();

describe('OMN-064 CHECKSIG reference semantics (TypeScript, real crypto)', () => {
  for (const fixture of fixtures) {
    it(`${fixture.name}: ${fixture.note}`, () => {
      const outcome = tsOutcome(fixture);
      // A rejected case may carry a runtime error (the reference implementation
      // throws on bad parameter counts and zero-length operands).
      expect({ name: fixture.name, passed: outcome.passed })
        .toEqual({ name: fixture.name, passed: fixture.expected });
    });
  }
});

const wasmSuite = wasm ? describe : describe.skip;

wasmSuite('OMN-064 CHECKSIG parity (Rust/WASM)', () => {
  const supported = fixtures.filter((fixture) => fixture.wasmSupport === 'supported');
  const pending = fixtures.filter((fixture) => fixture.wasmSupport !== 'supported');

  for (const fixture of supported) {
    it(`${fixture.name}: agrees with TypeScript`, () => {
      expect(wasmOutcome(fixture).passed).toBe(tsOutcome(fixture).passed);
      expect(wasmOutcome(fixture).passed).toBe(fixture.expected);
    });
  }

  it('has no remaining evaluator gaps', () => {
    // OMN-065 closed the tree-signature gap; keep this guard so a regression
    // (or a new fixture that only one evaluator supports) fails loudly.
    expect(pending.map((fixture) => fixture.name)).toEqual([]);
  });

  it('agrees with TypeScript on the parameter-count and operand rules', () => {
    for (const fixture of supported) {
      if (fixture.expected) continue;
      expect({ name: fixture.name, passed: wasmOutcome(fixture).passed })
        .toEqual({ name: fixture.name, passed: tsOutcome(fixture).passed });
    }
  });
});

describe('OMN-064 witness independence', () => {
  it('a witness signature cannot authorize data it did not sign', () => {
    const fixture = fixtures.find((entry) => entry.name === 'tree-signature-wrong-data')!;
    const result = evaluateScript(fixture.script, {
      signatures: new Map([['ab'.repeat(32), new Uint8Array(1088)]]),
    }, txCtx());
    expect(result.passed).toBe(false);
  });
});
