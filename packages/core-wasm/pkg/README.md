# @totemsdk/core-wasm

WOTS (Winternitz) cryptographic engine compiled to WebAssembly. Rust core for `@totemsdk/core`.

## Install

```bash
npm install @totemsdk/core-wasm
```

## What's inside

| Module | Description |
|--------|-------------|
| WOTS signatures | Winternitz One-Time Signatures (w=8, L=34) — sign, verify, key derivation |
| TreeKey | 3-level hierarchical key tree (262,144 signatures per seed) |
| MMR | Merkle Mountain Range proofs for TreeKey verification |
| BIP39 | Minima-compatible seed phrase generation and validation |
| Base32 | Minima Mx address encoding/decoding |
| Serialization | Java-compatible byte-exact Streamable serialization |
| TxPoW | Proof-of-work mining loop |
| Batch APIs | Sign/derive multiple keys in a single WASM call |

## Usage

```typescript
import { wots_sign_wasm, sha3_256_wasm, phrase_to_seed_wasm } from '@totemsdk/core-wasm';

const seed = phrase_to_seed_wasm('abandon abandon ... art');
const message = new Uint8Array(32);
const signature = wots_sign_wasm(seed, 0, message);
```

## Build

Requires Rust and wasm-pack:

```bash
wasm-pack build --target bundler --out-dir pkg
wasm-pack build --target nodejs --out-dir pkg-node
wasm-pack build --target web --out-dir pkg-web
```

`scripts/prepare-publish-assets.mjs` runs after every build and patches the
generated Node glue for Bare: it falls back from `node:fs` to the optional
`bare-fs` package and installs `bare-encoding/global` when the encoding globals
are missing. `pkg-web` is the portable async target (explicit wasm bytes, no
`fs`). Bare apps that need randomness should set
`globalThis.crypto = require('bare-crypto')`; `@noble/hashes` is patched so a
missing `node:crypto` no longer breaks import.

## License

Apache-2.0 — see [LICENSE](./LICENSE) and [NOTICE](./NOTICE).


## Testing

Tests live outside the published package:

- Unit/contract tests: `tests/unit/core-wasm/`
- Qualification/runtime suites: `tests/qualification/core-wasm/`
- Registry: `qualification/registry.json`

Package `test:*` scripts are thin repository delegates; tests are not shipped.
