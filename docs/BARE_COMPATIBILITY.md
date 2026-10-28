# Bare compatibility

`@totemsdk/core` exposes `init`/`initSync` from its public ESM entry so Bare
callers can initialize the portable WASM target explicitly.

Verified command:

```bash
pnpm smoke:bare
```

Run both gates:

```bash
pnpm smoke:bare          # direct Bare ESM smoke
pnpm smoke:bare:pack     # packed consumer (tarball install + bare-pack + run)
```

The packed gate installs the real `@totemsdk/core` and `@totemsdk/core-wasm`
tarballs into a temporary non-symlinked project, embeds the WASM as base64,
and runs the bundle under Bare. The direct smoke test exercises:

- `bare-encoding/global` for `TextEncoder`/`TextDecoder`;
- `bare-fs` for the `.wasm` asset;
- the public `@totemsdk/core` entry;
- SHA3-256, WOTS sign and WOTS verify.

`pnpm smoke:bare` resolves a globally installed `bare`, `BARE_BIN`, or the
platform binary installed by the workspace `bare` dev dependency.

## Packaging notes

- Do not treat a Node import smoke test as Bare evidence.
- The packed-consumer gate installs the package tarballs into a non-symlinked
  `node_modules` before packing so native addon prebuilds are discoverable.
  `node:crypto` is aliased to `bare-crypto` for `@noble/hashes`.
- `@totemsdk/core-wasm/pkg-web` is the portable target. The Node target imports
  `fs` and is intentionally not the Bare target.
- `@noble/hashes` is pinned to the workspace-patched version whose
  `node:crypto` require is optional.
