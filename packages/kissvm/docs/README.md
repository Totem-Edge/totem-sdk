# KISSVM — Totem SDK

KISSVM is the smart-contract VM embedded in Minima. The Totem SDK provides a pure-TypeScript evaluator, a template library, and MAST infrastructure for building, testing, and deploying KISSVM scripts.

## Quick start

```ts
import { evaluateScript, buildWitness } from '@totemsdk/kissvm'
import type { TxContext, ScriptWitness } from '@totemsdk/kissvm'

const script = 'RETURN SIGNEDBY(0xAA)'
const witness: ScriptWitness = {
  signatures: new Map([['aa', new Uint8Array(1088)]]),
}
const txCtx: TxContext = {
  block: 1000,
  inputIndex: 0,
  inputs: [{ amount: 100, tokenId: '0x00', coinId: '0xabc', address: '0xAA' }],
  outputs: [{ address: '0xAA', amount: 100, tokenId: '0x00', keepState: false }],
  state: {},
  prevState: {},
  simulationMode: true,
}

const result = evaluateScript(script, witness, txCtx)
console.log(result.passed) // true
```

## Package structure

| Path | Purpose |
|------|---------|
| `src/eval.ts` | Evaluator — `evaluateScript()` |
| `src/simulate.ts` | `simulateSpend()` — full transaction simulation |
| `src/parser.ts` | KISSVM parser (`parseScript()`) |
| `src/vm.ts` | VM state, scoping, execution limits |
| `src/types.ts` | Public types: `TxContext`, `ScriptWitness`, `EvalResult`, etc. |
| `src/templates/` | 33 template modules for on-chain scripts |
| `src/mast/` | MAST compiler, proof chains, policy trees, layered policies |
| `src/__tests__/` | Test suite |

## Documentation

| Document | What it covers |
|----------|----------------|
| [TEMPLATES.md](./TEMPLATES.md) | 33 template modules + 24 canonical `.kiss` examples |
| [REFERENCE.md](./REFERENCE.md) | Lang reference (absorbed from Minima guide) + evaluator API |
| [GAPS.md](./GAPS.md) | Code-gap analysis: operators & patterns not yet generated |

Canonical Minima reference (1437 pages):
[`./KISSVM_Comprehensive_Guide.md`](./KISSVM_Comprehensive_Guide.md)

24 canonical `.kiss` examples:
[`./examples/`](./examples/)

## Verification

Run the 24 canonical examples against the evaluator:

```bash
npx tsx src/__tests__/canonical-verify.ts
```

This tests all 24 `.kiss` files from the Minima library with both positive and negative cases (33 total assertions).

## MAST infrastructure

The SDK supports the full MAST lifecycle:

- `compileMastTree()` — compile a policy tree into nested MAST scripts
- `buildProofChain()` — build a linked proof chain
- `verifyProofChain()` — verify a proof chain end-to-end
- `computeCanonicalScriptHash()` / `computeCanonicalScriptAddress()` — address derivation
- `buildLayeredPolicy()` / `buildLayeredMastScript()` — layered (hierarchical) policies
- `buildPolicyAnchorScript()` / `buildRootRotationScript()` — anchor & rotate roots
- `buildStateTransition()` / `counterWorkflow()` / `vestingWorkflow()` — reusable prev-state workflows

See `src/mast/` for detail.
