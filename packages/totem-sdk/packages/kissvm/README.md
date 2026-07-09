# @totemsdk/kissvm

**Minima's smart contract language — in pure TypeScript.**

KISSVM (Keep It Simple Scripting Virtual Machine) is Minima's on-chain scripting language. This package is a complete evaluator for simulating coin spends, building witnesses, and validating scripts — all client-side with no node required.

## Install

```bash
npm install @totemsdk/kissvm
```

## What's inside

| Export | What it does |
|--------|-------------|
| `evaluateScript(script, context)` | Full VM execution — returns `true` / `false` |
| `simulateSpend(coin, tx, witness)` | Simulate a coin spend against its locking script |
| `buildWitness(inputs)` | Construct the witness data for a transaction |
| `parseScript(source)` | Parse KISSVM source to an AST |
| `KissvmLimitError` | Thrown when gas/resource limits are exceeded |
| `KissvmRuntimeError` | Thrown for runtime failures (invalid stack state, bad opcode, etc.) |

### Supported script types

`signedby` · `multisig` · `multisig_mofn` · `timelock` · `htlc` · `mast` · `exchange` · `vault` · `flashcash` · `slowcash` · `stateful` · `custom`

## Usage

### Simulate a spend

```typescript
import { simulateSpend, buildWitness } from '@totemsdk/kissvm';

const witness = buildWitness({
  signatures: [{ publicKey: pubKeyHex, signature: sigHex }],
  extraData: [],
});

const result = simulateSpend(coin, transaction, witness);
if (!result.success) {
  console.error('Script rejected:', result.error);
}
```

### Evaluate a script directly

```typescript
import { evaluateScript } from '@totemsdk/kissvm';

const script = 'RETURN SIGNEDBY(0xABC...)';
const context = {
  signatures: [{ publicKey: '0xABC...', signature: '0x...' }],
  blockTime: Date.now(),
};

const passed = evaluateScript(script, context);
```

### Parse to AST

```typescript
import { parseScript } from '@totemsdk/kissvm';

const ast = parseScript('RETURN SIGNEDBY(0xABC...) AND BLOCKTIME(1700000000)');
console.log(ast.statements);
```

### Error handling

```typescript
import { KissvmLimitError, KissvmRuntimeError } from '@totemsdk/kissvm';

try {
  simulateSpend(coin, tx, witness);
} catch (err) {
  if (err instanceof KissvmLimitError) {
    console.error('Script exceeded gas limit');
  } else if (err instanceof KissvmRuntimeError) {
    console.error('Runtime failure:', err.message);
  }
}
```

## Upstream Java source

This package is a TypeScript port of the Minima KISSVM scripting engine. Canonical upstream references:

- [`kissvm/Contract.java`](https://github.com/spartacusrex-minima/minima-core/blob/main/src/org/minima/kissvm/Contract.java) — KISSVM evaluator entry point
- [`kissvm/expressions/`](https://github.com/spartacusrex-minima/minima-core/blob/main/src/org/minima/kissvm/expressions/) — expression types
- [`kissvm/functions/`](https://github.com/spartacusrex-minima/minima-core/blob/main/src/org/minima/kissvm/functions/) — built-in functions
- [`kissvm/statements/`](https://github.com/spartacusrex-minima/minima-core/blob/main/src/org/minima/kissvm/statements/) — control-flow statements
- [`kissvm/tokens/`](https://github.com/spartacusrex-minima/minima-core/blob/main/src/org/minima/kissvm/tokens/) — lexer tokens
- [`kissvm/values/`](https://github.com/spartacusrex-minima/minima-core/blob/main/src/org/minima/kissvm/values/) — value types (boolean, hex, number, script)

## See also

- [`@totemsdk/connect`](https://www.npmjs.com/package/@totemsdk/connect) — `totemKissvmSimulate` / `totemKissvmValidate` extension methods
- [`@totemsdk/tx-builder`](https://www.npmjs.com/package/@totemsdk/tx-builder) — builds the transaction fed into `simulateSpend`
- [`@totemsdk/omnia`](https://www.npmjs.com/package/@totemsdk/omnia) — uses `KissvmEvaluator` interface for channel conditions
