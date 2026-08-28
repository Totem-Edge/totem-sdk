# @totemsdk/kissvm

**KISSVM v1 evaluator for Minima scripting language — backed by Rust/WASM.**

KISSVM (Keep It Simple Scripting Virtual Machine) is Minima's on-chain scripting language. This package provides a complete evaluator for simulating coin spends, building witnesses, and validating scripts — all client-side with no node required.

The evaluator is available in two engines:
- **Rust/WASM** (default, v0.2+) — compiled to WebAssembly for deterministic, high-performance execution
- **TypeScript** (fallback) — the original pure-TS implementation, always available

## Install

```bash
npm install @totemsdk/kissvm
```

## Quick start

```typescript
import { evaluateScript, simulateSpend, buildWitness } from '@totemsdk/kissvm';

const script = 'RETURN SIGNEDBY(0xABC...) AND @BLOCK GT 500';
const witness = buildWitness([{ pubkeyHex: '0xABC...', signature: sigBytes }]);
const ctx = { block: 600, inputIndex: 0, inputs: [coin], outputs: [out], state: {}, prevState: {} };

const result = evaluateScript(script, witness, ctx);
// { passed: true, trace: [...], instructionsUsed: 42 }
```

## Architecture

```
┌─────────────────────────────────────────────┐
│              @totemsdk/kissvm                │
│                                              │
│  ┌──────────────┐    ┌────────────────────┐ │
│  │  TypeScript   │    │   Rust/WASM Engine  │ │
│  │  (fallback)   │    │   (default)         │ │
│  │              │    │                    │ │
│  │  eval.ts     │    │  rust/src/         │ │
│  │  parser.ts   │    │  ├── types.rs      │ │
│  │  lexer.ts    │    │  ├── lexer.rs      │ │
│  │  vm.ts       │    │  ├── parser.rs     │ │
│  │  simulate.ts │    │  ├── vm.rs         │ │
│  │  witness.ts  │    │  ├── eval.rs       │ │
│  │              │    │  └── wasm.rs       │ │
│  └──────────────┘    └────────────────────┘ │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │         wasm-sync.ts (bridge)           │  │
│  │  evaluateScriptWasm / parseScriptWasm  │  │
│  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

## API

### TypeScript engine (always available)

| Export | Description |
|--------|-------------|
| `evaluateScript(script, witness, txCtx)` | Full VM execution — returns `EvalResult` |
| `simulateSpend(script, coin, txCtx, witness?)` | Simulate a coin spend with real WOTS verification |
| `buildWitness(inputs)` | Construct a `ScriptWitness` from signed inputs |
| `parseScript(source)` | Parse KISSVM source to an AST |
| `KissvmLimitError` | Thrown when gas/resource limits are exceeded |
| `KissvmRuntimeError` | Thrown for runtime failures |
| `sigdig(value, n)` | Round a number to `n` significant digits |

### WASM engine (v0.2+)

| Export | Description |
|--------|-------------|
| `evaluateScriptWasm(script, witness, txCtx)` | Rust/WASM evaluator — same API, better perf |
| `parseScriptWasm(source)` | Rust/WASM parser — returns serialized AST |

The WASM engine uses the same `ScriptWitness` and `TxContext` types as the TypeScript engine. Results are identical — the Rust port is a line-for-line translation of the TypeScript evaluator.

## Supported script types

`signedby` · `multisig` · `multisig_mofn` · `timelock` · `htlc` · `mast` · `exchange` · `vault` · `flashcash` · `slowcash` · `stateful` · `custom`

## Usage

### Simulate a spend

```typescript
import { simulateSpend, buildWitness } from '@totemsdk/kissvm';

const coin = { amount: 100, tokenId: '0x00', coinId: '0xabc', address: '0xdeadbeef' };
const txCtx = {
  block: 500,
  inputIndex: 0,
  inputs: [coin],
  outputs: [{ address: '0xdeadbeef', amount: 100, tokenId: '0x00', keepState: false }],
  state: {},
  prevState: {},
};

const witness = buildWitness([{ pubkeyHex: pkHex, signature: sigBytes }]);
const result = await simulateSpend('RETURN SIGNEDBY(0x...)', coin, txCtx, witness);
// { passed: true, trace: [...], instructionsUsed: 42 }
```

### Evaluate a script directly

```typescript
import { evaluateScript } from '@totemsdk/kissvm';

const script = 'RETURN @BLOCK GT 100 AND SIGNEDBY(0xABC...)';
const result = evaluateScript(script, witness, txCtx);
```

### Parse to AST

```typescript
import { parseScript } from '@totemsdk/kissvm';

const ast = parseScript('RETURN SIGNEDBY(0xABC...) AND @BLOCK GT 500');
```

### Error handling

```typescript
import { evaluateScript, KissvmLimitError, KissvmRuntimeError } from '@totemsdk/kissvm';

try {
  const result = evaluateScript(script, witness, ctx);
  if (!result.passed) console.error('Script rejected:', result.error);
} catch (err) {
  if (err instanceof KissvmLimitError) {
    console.error('Script exceeded instruction limit');
  } else if (err instanceof KissvmRuntimeError) {
    console.error('Runtime failure:', err.message);
  }
}
```

## Building from source

```bash
# Install Rust + wasm-pack
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
cargo install wasm-pack

# Build everything (WASM + TypeScript)
npm run build

# Build only the Rust/WASM engine
npm run build:wasm

# Run tests
npm test
```

### Rust crate structure

```
rust/
├── Cargo.toml          # Rust dependencies (sha3, num-bigint, wasm-bindgen, serde)
├── src/
│   ├── lib.rs          # Module declarations
│   ├── types.rs        # Value, VmValue, AstNode (30+ variants), TxContext, EvalResult
│   ├── lexer.rs        # Tokenizer — 60+ token kinds, full KISSVM syntax
│   ├── parser.rs       # Recursive descent parser — all statements + expressions
│   ├── vm.rs           # VM state — env stack, call frames, instruction counting
│   ├── eval.rs         # Evaluator — all opcodes, builtins, SIGNEDBY, MAST, PROOF, SIGDIG
│   └── wasm.rs         # WASM bindings — evaluate_script_wasm, parse_script_wasm
├── pkg/                # WASM bundler target (webpack, vite, etc.)
└── pkg-node/           # WASM Node.js target (CommonJS)
```

## VM limits

| Limit | Value | Description |
|-------|-------|-------------|
| `MAX_INSTRUCTIONS` | 1,024 | Total instruction count before `KissvmLimitError` |
| `MAX_STACK_DEPTH` | 64 | Maximum call/block nesting depth |
| `MAX_PARAMS` | 32 | Maximum function parameters |
| `MAX_STRING_BYTES` | 65,536 | Maximum string/hex literal size |
| `MAX_SHIFT_BITS` | 256 | Maximum bit-shift amount |

## Fixed-point arithmetic

All numeric values use scaled `BigInt` arithmetic with `SCALE = 10^8` (8 decimal places), matching Minima's MiniNumber precision:

| Operation | Formula |
|-----------|---------|
| ADD / SUB | `a + b` / `a - b` |
| MUL | `(a × b) / SCALE` |
| DIV | `(a × SCALE) / b` |
| MOD | `a mod b` |
| LSHIFT | `(n / SCALE) << k` then re-scale |
| RSHIFT | `(n / SCALE) >> k` then re-scale |

## Upstream Java source

This package is a TypeScript port of the Minima KISSVM scripting engine. Canonical upstream references:

- [`kissvm/Contract.java`](https://github.com/spartacusrex-minima/minima-core/blob/main/src/org/minima/kissvm/Contract.java) — KISSVM evaluator entry point
- [`kissvm/expressions/`](https://github.com/spartacusrex-minima/minima-core/blob/main/src/org/minima/kissvm/expressions/) — expression types
- [`kissvm/functions/`](https://github.com/spartacusrex-minima/minima-core/blob/main/src/org/minima/kissvm/functions/) — built-in functions
- [`kissvm/statements/`](https://github.com/spartacusrex-minima/minima-core/blob/main/src/org/minima/kissvm/statements/) — control-flow statements
- [`kissvm/tokens/`](https://github.com/spartacusrex-minima/minima-core/blob/main/src/org/minima/kissvm/tokens/) — lexer tokens
- [`kissvm/values/`](https://github.com/spartacusrex-minima/minima-core/blob/main/src/org/minima/kissvm/values/) — value types

## MAST & Policy Infrastructure

This package now includes the full MAST compiler, policy tree, proof chain, layered policy, anchor coin, PREVSTATE workflows, and 17 ready-to-use script templates. See [`GUIDE.md`](https://github.com/Totem-Edge/totem-sdk/blob/main/packages/kissvm/src/GUIDE.md) for complete documentation.

```ts
import { compileMastTree, verifyScriptMembership } from '@totemsdk/kissvm';
import { buildPolicyTree } from '@totemsdk/kissvm';
import { buildProofChain, verifyProofChain } from '@totemsdk/kissvm';
import { buildLayeredPolicy } from '@totemsdk/kissvm';
import { buildFirmwareUpdateScript } from '@totemsdk/kissvm';
```

### Quick overview

| Module | Description |
|--------|-------------|
| `mast/` | MMR compiler, policy tree, proof chains, layered policy, anchor coin, PREVSTATE workflows |
| `templates/` | 17 script generators (firmware, voting, state machine, recovery, supply chain, etc.) |

## See also

- [`@totemsdk/core`](https://www.npmjs.com/package/@totemsdk/core) — cryptographic primitives (SHA3, WOTS, TreeKey)
- [`@totemsdk/core-wasm`](https://www.npmjs.com/package/@totemsdk/core-wasm) — Rust/WASM crypto engine
- [`@totemsdk/recursive-mast`](https://www.npmjs.com/package/@totemsdk/recursive-mast) — higher-level policy coordination (delegation, discovery, signing, storage)
- [`@totemsdk/tx-builder`](https://www.npmjs.com/package/@totemsdk/tx-builder) — builds transactions for `simulateSpend`
- [`@totemsdk/omnia`](https://www.npmjs.com/package/@totemsdk/omnia) — payment channel state machine using KISSVM
