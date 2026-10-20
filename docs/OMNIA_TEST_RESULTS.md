# Omnia test results — S1–S11

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
| **S6** | **PASS** | SDK harness: pool → mint → signed receipts → transfer → refresh → exit |
| **S7** | **PASS** | SDK harness + host coordination (unit); live 2-host E2E pending |
| **S8** | **PASS** | SDK harness: 3-hop fee-aware payment, per-hop amounts, fee retention |
| **S9** | **PASS** | local relay; two relay-backed swarms; PING/ACK round-trip; 2 relay clients |
| **S10** | **PASS** | SDK harness: pool → deposit → allocate → release → withdraw → rooted payout |
| **S11** | **PENDING** | Axia watchtower (in `axia-platform`); after S4/S5, HTLC cases after S8 |

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

### S9 — relay round-trip

`scripts/omnia-s9-relay.mjs` starts a self-hosted relay on an ephemeral loopback
port and connects two `HostedRelaySwarmImpl` clients. B sends `PING` over the
relay; A replies `ACK` on the same peer. Result:

```
OMNIA_RESULT {"stage":"S9","transport":"relay","relayClients":2,
  "channelId":"s9-relay","pass":true}
S9_PASS
```

The run also exposed a concurrent-connect leak in `HostedRelaySwarmImpl`
(`advertise` racing `connectToPeer` opened one socket per caller); `_connect` is
now shared and the relay reports exactly 2 clients.

### S6 — virtual-UTXO claims

`scripts/omnia-s6-vtxo.mjs` uses the real `omnia-vtxo` primitives with a unified
TreeKey operator (real WOTS receipts) and an in-memory lease provider: create
pool, mint 100k, co-sign/verify the mint receipt, partially transfer 40k with a
60k change, co-sign/verify the transfer receipt with conservation, refresh to
epoch 1, co-sign/verify, then exit draft → exiting → exited. A wrong-root receipt
is rejected.

```
OMNIA_RESULT {"stage":"S6","minted":{"amount":"100000"},
  "transfer":{"amount":"40000","changeAmount":"60000"},
  "refreshed":{"epoch":1},"exit":{"draftAmount":"40000","status":"exited"},
  "pass":true}
S6_PASS
```

### S7 — splice in/out

`scripts/omnia-s7-splice.mjs` uses the real splice state machine with
deterministic mock WOTS signers and `MAX_HASH` mining: quiesce → propose
splice-in → accept → finalize (1000→1500), then a fresh channel → quiesce →
propose splice-out → accept → finalize (1000→500, withdraw 500). Asserts balances,
the new funding coin id, and that the old quiesced channel is invalidated.

```
OMNIA_RESULT {"stage":"S7","spliceIn":{"from":"1000","to":"1500"},
  "spliceOut":{"from":"1000","to":"500","withdrawAmount":"500"},"pass":true}
S7_PASS
```

Host coordination is implemented: `lifecycle.ts` wires the splice lease/proposal
stores, the proposer drives `SPLICE_PROPOSAL → SPLICE_ACCEPT → finalize →
SPLICE_FINALIZED`, and the responder quiesces/accepts and commits its reservation
on finalization. `packages/omnia-host/src/__tests__/splice-coordination.test.ts`
covers the proposer path. A live two-host on-chain splice E2E remains.

### S8 — fee-aware multi-hop

`scripts/omnia-s8-router.mjs` runs a real three-hop route (Alice → Hop1 → Hop2 →
Carol) through the routing engine and executor with deterministic in-memory HTLC
ops. The executor locks the payment plus downstream fees and each intermediary
retains the difference:

```
payer 10,020,000,000 -> hop1 10,010,000,000 -> hop2 10,000,000,000 (scaled)
Hop1 retains 10,000,000; Hop2 retains 10,000,000; Carol receives 10,000,000,000
settledHops=3 feeProofs=3
```

Three-host E2E and cross-token routing remain future work.

### S10 — pool lifecycle

`scripts/omnia-s10-pool.mjs` uses the real `@totemsdk/omnia-pool` accounting with
an in-memory `liquidity-bond` registry: create pool, deposit 100k, allocate 50k,
check NAV, release, withdraw 1k, approve, and execute a payout with confirmed
settlement plus a rooted registry transition. Result:

```
OMNIA_RESULT {"stage":"S10","deposited":"100000","allocated":"50000",
  "withdrawn":"1000","remaining":"99000","nav":"99000",
  "payoutStatus":"settled-externally","rooted":true,"pass":true}
S10_PASS
```

### S11 — Axia watchtower

Deferred to `axia-platform` with its own integration tests; see
`OMNIA_TEST_PLAN.md` §S11. It cannot run from this harness because it needs the
Axia API, Postgres, Redis, and the TxPoW indexer.

### Package test suites (SDK)

| Package | Suites | Tests |
|---|---|---|
| `@totemsdk/core` | 26 | 288 |
| `@totemsdk/txpow` | 4 | 136 |
| `@totemsdk/omnia` | 9 | 223 |
| `@totemsdk/omnia-host` | 12 | 59 |
| `@totemsdk/stream-transport` | 2 | 20 |
| `@totemsdk/omnia-vtxo` | 17 | 187 |
| `@totemsdk/omnia-splice` | 3 | 75 |
| `@totemsdk/omnia-router` | 5 | 79 |
| `@totemsdk/omnia-pool` | 4 | 40 |
| `@totemsdk/liquidity-bond` | 17 | 170 |

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
2. **S6/S7/S10** are closed at the SDK-harness level; host methods (and, for
   splice, the peer accept/finalize exchange) remain future work. S8 is green at
   the SDK level; a three-host end-to-end run and cross-token routing remain.
3. **S7** splice managers are not wired into the host CLI.
4. **S8** needs a third host and fee-adjusted per-hop amounts/retention.
5. **S11** (Axia watchtower) needs the Axia API/DB/Redis/indexer; test after
   S5 (disputes/WOTS) and S8 (HTLC timeouts).
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
| 2026-10-20 | S9 | relay | `d9477ba3` | PASS | local relay; 2 clients; `omnia-s9-relay.mjs` |
| 2026-10-20 | S6 | in-memory | `040dbf51` | PASS | VTXO mint/transfer/refresh/exit; `omnia-s6-vtxo.mjs` |
| 2026-10-20 | S7 | in-memory | `71c10b68` | PASS | splice-in/out; `omnia-s7-splice.mjs` |
| 2026-10-20 | S8 | in-memory | uncommitted | PASS | 3-hop fee-aware; `omnia-s8-router.mjs` |
| 2026-10-20 | S10 | in-memory | `1fe96913` | PASS | pool lifecycle; `omnia-s10-pool.mjs` |
| 2026-10-20 | runtime | — | `d9ef523c` + Bare fix | PASS (Node/Bun/Bare) | `runtime-smoke.cjs`; Bun native skipped (upstream) |

To add a run: append a row, then add the command, `OMNIA_RESULT` JSON, and log
paths under the relevant stage section. Re-run `scripts/omnia-{s4,s5}-cross.mjs`
with `--json` for a clean result line.
