# @totemsdk/core

**The cryptographic engine — every other package depends on this.**

Zero production dependencies (only `@noble/hashes` as a peer). Provides WOTS (Winternitz) signatures, hierarchical TreeKey address derivation, BIP39 seed phrases, Merkle Mountain Range proofs, and byte-exact Minima Java-compatible transaction serialization.

## Install

```bash
npm install @totemsdk/core @noble/hashes
```

## Bundling for edge / Workers

The root entry (`@totemsdk/core`) re-exports the synchronous WASM crypto bridge
(`@totemsdk/core/wasm`), which imports `@totemsdk/core-wasm` at module load. That
glue uses a bundler-target `import * as wasm from "./….wasm"` (and, on the Node
path, `fs`/`__dirname`), so a stock `esbuild` build targeting Cloudflare Workers
(or any async-WASM edge runtime) fails to resolve or instantiate it.

Import a wasm-free subpath instead of the root when you don't need the WASM
crypto:

| Need | Import | Notes |
|---|---|---|
| Adapter contracts / types (`StorageAdapter`, `WebSocketFactory`, `WebSocketReadyState`, …) | `@totemsdk/core/adapters` | Same names as the root — safe drop-in. |
| Pure-JS crypto | `@totemsdk/core/legacy` | JS implementations are **`legacy`-prefixed** (`legacyWotsSign`, `legacyWotsVerify`, `legacyWotsKeypairFromSeed`, …); `verifySignature*` are unprefixed. **Not** a drop-in for the root's `wotsSign`. |
| WASM crypto (async, portable to edge/Workers/Bare) | `@totemsdk/core/wasm` | ESM-only; `await init()` once (optionally with explicit wasm bytes), then synchronous calls. Alias: `./wasm-async`. |
| WASM crypto (sync, Node/bundler with a `.wasm` loader) | `@totemsdk/core/wasm-sync` | Same names as the root; initializes at import. |

Immediate unblock without an SDK change (adapter-only consumers):

```bash
esbuild --alias:@totemsdk/core=@totemsdk/core/adapters
```

`@totemsdk/core` does not set `"sideEffects": false` (the WASM bridge
initializes at import), so bundlers will not tree-shake the WASM re-export away;
prefer explicit subpath imports over relying on tree-shaking.

### Deprecation & migration (RFC-031)

`@totemsdk/core/legacy` is **deprecated and frozen** — the pure-JS kernels will be
removed in a major release; no new kernels are added there. Prefer the WASM
surface (`@totemsdk/core/wasm` for synchronous use, `@totemsdk/core/wasm-async`
for edge/Workers). Typical migration:

```ts
// before — pure-JS, legacy-prefixed
import { legacyWotsSign, legacyWotsVerify } from '@totemsdk/core/legacy';
// after — async-init WASM, same names as the root
import { init, wotsSign, wotsVerify } from '@totemsdk/core/wasm-async';
await init();
```

Use `/legacy` only where WASM genuinely cannot run; `verifySignature*` and the
adapter contracts are unaffected.

### Bare / Pear

Bare (Holepunch, V8-based) can run the portable `./wasm-async` entry, but does not
provide the `TextEncoder`/`TextDecoder` globals the wasm-bindgen glue uses — import
`bare-encoding/global` first:

```ts
import 'bare-encoding/global';           // Bare only
import { init, sha3_256 } from '@totemsdk/core/wasm-async';
await init();                            // optionally with explicit wasm bytes
```

## What's inside

| Module | What it does |
|--------|-------------|
| **WOTS** | `wotsKeypairFromSeed`, `wotsSign`, `wotsVerify`, `wotsPkFromSig` — quantum-resistant Winternitz One-Time Signatures |
| **TreeKey** | `createPerAddressTreeKey`, `verifyTreeSignature` — 3-level hierarchical signing trees; one seed → many signing addresses |
| **BIP39** | `generateSeedPhrase`, `validatePhrase`, `phraseToSeed` — 24-word mnemonic generation and recovery |
| **MMR** | Full Merkle Mountain Range proof construction and verification for Minima's UTXO set |
| **Serialization** | `serializeCoin`, `serializeTransaction`, `computeTransactionDigest`, `buildMinimaCoin` — byte-identical to the Minima Java node |
| **Verification** | `verifySignatureDetailed`, `verifyTreeSignatureDetailed` — server-side auth helpers |
| **Lease/Watermark** | `LeaseStore`, `WatermarkStore`, `LeaseMonitor` — WOTS key-use accounting to prevent catastrophic key reuse |
| **TransactionService** | High-level prepare → sign → finalize lifecycle with receipt tracking |
| **MINIMA_CONSTANTS** | Canonical chain parameters (`WOTS_W=8`, `MAX_SIGNATURES=262144`, `ADDRESS_PREFIX="Mx"`) |

## Usage

### WOTS keypair and signing

```typescript
import { wotsKeypairFromSeed, wotsSign, wotsVerify } from '@totemsdk/core';

const seed = crypto.getRandomValues(new Uint8Array(32));
const keypair = wotsKeypairFromSeed(seed, 0);

// Sign — each (seed, index) pair is one-time use
const signature = wotsSign(seed, 0, message);

// Verify
const ok = wotsVerify(signature, message, keypair.pk);
```

### Per-address TreeKey (matches Minima Wallet.java)

```typescript
import { createPerAddressTreeKey } from '@totemsdk/core';

// One independent 3-level tree per address index (0–63)
const treeKey = createPerAddressTreeKey(baseSeed, 0);

// Convert watermark (l1, l2) to a flat counter
const uses = l1 * 64 + l2;
treeKey.setUses(uses);
const { signature, publicKey, proofs } = treeKey.sign(data);
```

### Address derivation and verification

```typescript
import { scriptToAddress, publicKeyToScript, verifySignature } from '@totemsdk/core';

const script   = publicKeyToScript(publicKeyHex);
const address  = scriptToAddress(script); // "Mx..."

const ok = verifySignature(address, message, signatureHex, publicKeyHex);
```

### Replay-safe challenge/response

```typescript
import { createChallenge, validateChallenge } from '@totemsdk/core';

// Server: create a challenge
const challenge = createChallenge('my-dapp.example.com');

// Server: validate before accepting a signature
const { valid, error } = validateChallenge(challenge, {
  maxAgeMs: 5 * 60 * 1000,
  expectedDomain: 'my-dapp.example.com',
});
```

## Upstream Java source

This package is a TypeScript port of core Minima Java cryptographic and data structures. Canonical upstream references:

- [`objects/keys/Winternitz.java`](https://github.com/spartacusrex-minima/minima-core/blob/main/src/org/minima/objects/keys/Winternitz.java) — WOTS signing/verification
- [`objects/keys/TreeKey.java`](https://github.com/spartacusrex-minima/minima-core/blob/main/src/org/minima/objects/keys/TreeKey.java) — hierarchical signing tree
- [`objects/keys/TreeKeyNode.java`](https://github.com/spartacusrex-minima/minima-core/blob/main/src/org/minima/objects/keys/TreeKeyNode.java) — tree node internals
- [`database/wallet/Wallet.java`](https://github.com/spartacusrex-minima/minima-core/blob/main/src/org/minima/database/wallet/Wallet.java) — key derivation (`modifier = BigInteger(numkeys)` → SHA3 → TreeKey)
- [`utils/Streamable.java`](https://github.com/spartacusrex-minima/minima-core/blob/main/src/org/minima/utils/Streamable.java) — byte-exact serialization interface
- [`objects/Coin.java`](https://github.com/spartacusrex-minima/minima-core/blob/main/src/org/minima/objects/Coin.java) — UTXO structure
- [`objects/Transaction.java`](https://github.com/spartacusrex-minima/minima-core/blob/main/src/org/minima/objects/Transaction.java) — transaction structure
- [`objects/Token.java`](https://github.com/spartacusrex-minima/minima-core/blob/main/src/org/minima/objects/Token.java) — token metadata
- [`objects/mmr/MMR.java`](https://github.com/spartacusrex-minima/minima-core/blob/main/src/org/minima/objects/mmr/MMR.java) — Merkle Mountain Range
- [`objects/mmr/MMRProof.java`](https://github.com/spartacusrex-minima/minima-core/blob/main/src/org/minima/objects/mmr/MMRProof.java) — MMR proof structure

## See also

- [`@totemsdk/connect`](https://www.npmjs.com/package/@totemsdk/connect) — dApp gateway built on top of core
- [`@totemsdk/wots-lease`](https://www.npmjs.com/package/@totemsdk/wots-lease) — cloud-coordinated WOTS key safety
- [`@totemsdk/tx-builder`](https://www.npmjs.com/package/@totemsdk/tx-builder) — full transaction construction
- [`@totemsdk/root-identity`](https://www.npmjs.com/package/@totemsdk/root-identity) — multi-address identity from one seed
