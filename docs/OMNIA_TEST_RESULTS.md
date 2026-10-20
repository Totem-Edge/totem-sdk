# Omnia test results — S1–S10

**Snapshot:** 2026-10-20 (two-host session 2026-10-19/20).
**Plan:** [`OMNIA_TEST_PLAN.md`](./OMNIA_TEST_PLAN.md).
**SDK commits in scope:** `fddce8c6` (reliable proposals/idempotent replies),
`d9ef523c` (runtime harness), `e604b4cd` (S5 factory/VC), `b621c2a5` (S4
settlement + explicit TxPoW mining), `12e37e73` (transport identity),
`0a39a6c9` (explicit DHT), `be585260` (single live transport per peer).

---

## Status

| Stage | Result | Evidence |
|---|---|---|
| **S1** | **PASS** | `@totemsdk/omnia-host` builds `dist/cli.js`; starts with `OMNIA_*` config |
| **S2** | **PASS** | `/healthz` `{ok:true}`; `totem_omniaWhoami` + `totem_omniaGetManifest` return identity + signed manifest |
| **S3** | **PASS** | two Minima nodes (RPC 9005/9015) and two hosts (control 50052/50053) healthy on separate OCI instances |
| **S4** | **PASS** | `openChannel → pay → settle → closeChannel`; settlement TxPoW accepted as a main-chain block |
| **S5** | **PASS** | `createFactory → openVirtualChannel → closeVirtualChannel`; allocations restored (native, two hosts) |
| **S6** | **PENDING** | `omnia-vtxo` has no host methods yet |
| **S7** | **PENDING** | splice managers not wired into the host CLI |
| **S8** | **PENDING** | needs 3 hosts and fee-adjusted per-hop amounts |
| **S9** | **PENDING** | relay server/client exist; formal harness still to add |
| **S10** | **PENDING** | `omnia-pool` orchestration is SDK-harness only |

---

## Environment

### Hosts (OCI A1, free tier)

| | A | B |
|---|---|---|
| Instance | `mash-a1-bench2` | `mash-a1-native-b` |
| Public IP | `79.72.84.151` | `132.145.29.115` |
| Private IP | `10.0.0.210` | `10.0.0.55` |
| Control plane | `50052` (`/rpc`, bearer `test`) | `50053` (`/rpc`, bearer `test`) |
| Minima RPC | `9005` | `9015` |
| Party ID | `totem:id:service:b89c1903…00a2d` | `totem:id:service:535504ca…a65f0` |
| Transport key | `0xBB252FF3…B99991` | `0xF54FC84B…385FF` |
| Seed | `0xa1a1…a1` | `0xb2b2…b2` |

Both run with `OMNIA_DEBUG=1`, `OMNIA_NATIVE_DIRECT=0`, an explicit
`OMNIA_DHT_HOST`, and the same real DHT seed:

```
8146640f02493af4fbc54fe33388e75dc2c937ae0b7727cc2b2afb1b75199a3e@10.0.0.210:49737
```

The seed is a **real DHT node** (`dht-seed.mjs`), not `DHT.bootstrapper` (which
does not route announces). Ingress `10.0.0.0/24` is open in the OCI security list
and in each host's iptables.

### Local prerequisites

- `hawk-node` `main` with the `magic` command and the JSON `const char*` fix
  (local, uncommitted at snapshot time).
- `totem-sdk` at the commits above; SDK packages built on both hosts
  (`tsc` ESM + CJS), `omnia-host` built.
- Factory lease bundles are created by the host at startup from the local seed.

---

## Evidence

### S1 / S2 / S3

`omnia-host` started on both hosts (`/tmp/host-a.log`, `/tmp/host-b.log`).
`totem_omniaWhoami` returned the addresses/party IDs above; `totem_omniaGetManifest`
returned a signed edge-service manifest including `transportPubkey`. Both Minima
nodes reached the same tip before the channel tests.

### S4 — core channel lifecycle (relay)

Flow: `openChannel` with a 60/40 split of a spendable coin, `pay` (off-chain
update propagated to the counterparty), `settle` (bilateral co-sign, on-chain
broadcast), `closeChannel`.

Key observations:

- The settlement transaction met block difficulty and was accepted as a
  **main-chain block** (so it appears in `mempool`/chain, not "stuck").
- Node log showed no "too low difficulty" / "Script Missing" after the
  `buildScriptProof` + `computeScriptAddress` fix (`659a5542`/`3279e3d1`).
- The channel coin was spent by settlement; `closeChannel` then marked the local
  channel closed.

Harness now mirrored as `scripts/omnia-s4-cross.mjs` (it also waits for
`contestDelay + 1` blocks of channel-coin coinage before settling).

### S5 — factory + virtual channel (native, two hosts)

First native pass (2026-10-20):

```
factoryId  37147d8e0015ec326f255d54bc49fc32dfc341a33c8550783eac6154d6c55ade
channelId  vc-37147d8e-totem:id:service:b89c1903…-totem:id:service:535504ca…-c17001f32923f9c1
allocations A=100000000 B=100000000   (restored after close)
```

`createFactory` sent `FACTORY_PROPOSAL`; B accepted and stored the factory;
`openVirtualChannel` exchanged `VC_PROPOSAL`/`VC_ACCEPT` and both signed the
factory-state commitment; `closeVirtualChannel` exchanged the close proposal and
restored both 100M allocations. A second immediate run passed with **zero**
`stream closed`/`rebound`/`drop` lines and **zero** `ERROR` frames on either host.

Resilience runs:

- Restarted B between runs; A reconnected with exactly one
  `stream closed → refresh → rebound` and S5 passed.
- Froze B in the proposal window, killed it, restarted it; S5 still completed.

Harness mirrored as `scripts/omnia-s5-cross.mjs`. A confirmation run with the
mirrored harness on the same hosts produced:

```
factoryId  e342d9bd030234057a86c01d6974d1b9cc288bd60c99fb80ba602567f3e65e55
channelId  vc-e342d9bd-…-8aad94acb1f37613
allocations A=100000000 B=100000000
S5_PASS
```

### Package test suites (SDK)

| Package | Suites | Tests |
|---|---|---|
| `@totemsdk/core` | 26 | 288 |
| `@totemsdk/txpow` | 4 | 136 |
| `@totemsdk/omnia` | 9 | 223 |
| `@totemsdk/omnia-host` | 11 | 58 |
| `@totemsdk/stream-transport` | 2 | 20 |

### Runtime portability

`scripts/runtime-smoke.cjs` (core, txpow, stream-transport, omnia peer,
factory/VC lifecycle):

| Runtime | SDK checks | Native check |
|---|---|---|
| Node 22 | 5/5 | 6/6 with `OMNIA_SMOKE_HOST=<LAN IP>` |
| Bun 1.3.14 | 5/5 | **skip** — `udx-native` panics on `uv_interface_addresses` (oven-sh/bun#18546) |
| Bare 1.35 | 5/5 | n/a |

Bare support (fixed 2026-10-20):

- `core-wasm/pkg-node` falls back from node's `fs` to `bare-fs` and installs
  `bare-encoding/global` when the encoding globals are absent. Both are optional
  dependencies; `prepare-publish-assets.mjs` applies the fallback after every
  wasm build so regeneration is safe.
- `@noble/hashes` is patched so `node:crypto` is optional and
  `globalThis.crypto` is the fallback. A Bare app that needs randomness sets
  `globalThis.crypto = require('bare-crypto')`.
- Verified with `bare scripts/runtime-smoke.cjs` and with
  `--no-encoding-shim` (both 5/5, i.e. the SDK's own encoding fallback).

---

## Open issues / next gates

1. **S5 `closeFactory`** (on-chain factory settlement) is not exercised
   end-to-end: the host does not yet accept per-participant funding material.
2. **S6/S10** need host methods for VTXO/pool; currently SDK-only.
3. **S7** splice managers are not wired into the host CLI.
4. **S8** needs a third host and fee-adjusted per-hop amounts/retention.
5. **S9** needs a formal relay round-trip harness using `@totemsdk/omnia-relay`.
6. **Native direct mode** (`OMNIA_NATIVE_DIRECT=1`) is intentionally disabled for
   the two-host tests: raw `dht.connect` bypasses hyperswarm's connection
   management and churns. Rendezvous (single dialer) is the supported path.
7. External independent audit (G4) and Stage-T scale-up remain outside this
   harness.

---

## Run log

| Date | Stage | Transport | SDK commit | Result | Evidence |
|---|---|---|---|---|---|
| 2026-10-20 | S1–S3 | — | `0a39a6c9` | PASS | whoami/manifest; both hosts healthy |
| 2026-10-20 | S4 | relay | `b621c2a5` | PASS | settlement on-chain; harness `omnia-s4-cross.mjs` |
| 2026-10-20 | S5 | native | `e604b4cd`…`fddce8c6` | PASS | factory `37147d8e…`, VC `c17001f3…`, 100M/100M |
| 2026-10-20 | S5 restart | native | `fddce8c6` | PASS | one rebind; zero churn/ERROR |
| 2026-10-20 | S5 (mirrored harness) | native | `fddce8c6` | PASS | factory `e342d9bd…`, VC `8aad94ac…`, 100M/100M |
| 2026-10-20 | runtime | — | `d9ef523c` + Bare fix | PASS (Node/Bun/Bare) | `runtime-smoke.cjs`; Bun native skipped (upstream) |

To add a run: append a row, then add the command, `OMNIA_RESULT` JSON, and log
paths under the relevant stage section. Re-run `scripts/omnia-{s4,s5}-cross.mjs`
with `--json` for a clean result line.
