# Bare compatibility

`@totemsdk/core` exposes `init`/`initSync` from its public ESM entry so Bare
callers can initialize the portable WASM target explicitly.

Verified command:

```bash
pnpm smoke:bare
```

The smoke test runs under a real Bare binary and exercises:

- `bare-encoding/global` for `TextEncoder`/`TextDecoder`;
- `bare-fs` for the `.wasm` asset;
- the public `@totemsdk/core` entry;
- SHA3-256, WOTS sign and WOTS verify.

`pnpm smoke:bare` resolves a globally installed `bare`, `BARE_BIN`, or the
platform binary installed by the workspace `bare` dev dependency.

## Packaging notes

- Do not treat a Node import smoke test as Bare evidence.
- A `bare-pack` consumer fixture should install the package tarball into a
  non-symlinked `node_modules` before packing so native addon prebuilds are
  discoverable. The repository smoke test above validates the ESM/runtime
  surface; the packed-consumer gate remains a separate required check.
- `@totemsdk/core-wasm/pkg-web` is the portable target. The Node target imports
  `fs` and is intentionally not the Bare target.
- `@noble/hashes` is pinned to the workspace-patched version whose
  `node:crypto` require is optional.
