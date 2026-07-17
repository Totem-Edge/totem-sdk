# @totemsdk/core-wasm

Quantum-resistant WOTS+ cryptographic engine compiled to WebAssembly. Rust core for `@totemsdk/core`.

## Install

```bash
npm install @totemsdk/core-wasm
```

## What's inside

| Module | Description |
|--------|-------------|
| WOTS+ signatures | Winternitz One-Time Signatures (w=8, L=34) — sign, verify, key derivation |
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
```

## License

MIT
