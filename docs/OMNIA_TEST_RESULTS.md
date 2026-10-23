# Omnia test results — S1–S11

**Snapshot:** 2026-10-21 (OCI two-host + AWS 8-node session).
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
| **S4** | **PASS** | Native `txnmine` path on AWS: `openChannel → pay → settle → closeChannel`; settlement TxPoW on-chain |
| **S5** | **PASS** | `createFactory → openVirtualChannel → closeVirtualChannel`; 8-host ring + chord mesh, allocations restored |
| **S6** | **PASS** | SDK + host harness: pool → mint → signed receipts → transfer → refresh → exit |
| **S7** | **PASS** | SDK harness + host coordination (unit); live 2-host E2E pending |
| **S8** | **PASS** | 8-node routing graph: 7-hop ring, 4-hop chorded, all-pairs routes, fee-aware settlement |
| **S9** | **PASS** | local relay; two relay-backed swarms; PING/ACK round-trip; 2 relay clients |
| **S10** | **PASS** | SDK + host harness: pool → deposit → allocate → release → withdraw → rooted payout |
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

S5 `closeFactory` host plumbing: `createFactory` now accepts per-participant
funding material (`coinProof`, address/script, optional precomputed signature or
a local wallet signer) and passes it to the SDK funding path; `closeFactory`
accepts the factory coin proof. `factory-funding.test.ts` covers the wiring. A
live two-party on-chain factory funding run still needs the funding-signature
exchange (the digest is only known after both coin ids are fixed).

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

#### S8 — non-custodial coordinator/wallet split (AWS)

`scripts/omnia-wallet-service.mjs` and `scripts/omnia-noncustodial-host.mjs` ran
three coordinator hosts on AWS A/B/C against copied A–B and B–C channels:

- each host process had **no `OMNIA_HOST_SEED`/`OMNIA_HOST_KEYFILE`** and no local
  lease journal; it held only its transport key and public participant identity;
- signing and WOTS reservations were delegated over loopback HTTP to a separate
  wallet-service process holding the seed;
- the copied channel rows were normalised to carry explicit transport pubkeys
  (the older copied channels predated the transport-preservation fix);
- A→B→C HTLC lock/fulfill completed: `S8_HOST_HTLC_PASS`.

Final balances from that run:

```text
A–B: 43,000,000 / 52,000,000
B–C: 47,030,000 / 51,980,000
amount 1,000,000; fee 10,000
```

Negative control: stopping A's wallet service and calling `omniaPay` returned
`fetch failed`; the coordinator host could not produce a signature on its own.
This proves the host/wallet boundary, not just the custody-mode label.

#### Non-custodial open → pay → settle (AWS D/E)

`scripts/omnia-open-noncustodial.mjs` and
`scripts/omnia-settle-noncustodial.mjs` repeated the lifecycle with coordinator
hosts D/E and separate wallet services. Neither host process had a seed; D's
wallet signed the funding digest and both wallet services signed the update and
settlement. D/E's funding coin was sent from a fresh private node.

```text
NONCUSTODIAL_OPEN_PASS
channel 0xb5975516d744659c1b594bcedafc2e44
funding 0x0003C2E69477D360E8E1B44B6F187189C025A666C0907D5EA71F43C562556244
initial 60,000,000 / 40,000,000

pay 5,000,000 -> 55,000,000 / 45,000,000 (both hosts sequence 1)
NONCUSTODIAL_SETTLE_PASS
settlement 0x0001275535774A7C9B266F6500CB35CE0442E7FF41A136C1A0EA5859394810B5
```

The channel settlement addresses had to be supplied as hex script addresses;
the harness now derives them from the wallet's WOTS script (`addressHex`) and
publishes them via `whoami` for subsequent opens.

#### Non-custodial 7-hop and factory/VC (AWS A–H)

Eight coordinator hosts A–H ran with separate wallet services and **no host
seed**. Seven edge factories/VCs were opened non-custodially (A–B … G–H), then a
7-hop HTLC was locked and fulfilled backwards:

```text
A→B 1,000,000 → B→C 990,000 → C→D 980,000 → D→E 970,000
→ E→F 960,000 → F→G 950,000 → G→H 940,000
S8_HOST_HTLC7_PASS
```

Final per-edge balances each retain 10,000 per hop. The same run exercised
non-custodial `createFactory → openVirtualChannel → closeVirtualChannel`; the
close returned both 100M allocations. No funding coin was needed for these
in-memory factory/VC opens.

#### Non-custodial failure/recovery and VTXO/pool

Wallet-down then retry on the same channel sequence now succeeds after the
watermark release fix. An expired HTLC was added and timed out; both hosts
reported `timed_out` at sequence 3. `scripts/omnia-s6-s10-noncustodial.mjs`
then ran VTXO mint/transfer/refresh/exit and pool
deposit/allocate/release/withdraw through a coordinator host with a separate
wallet service: `S6_S10_NONCUSTODIAL_PASS`.

#### Non-custodial timeout/reconnect/concurrency (AWS A–H)

Using the seven non-custodial edge VCs:

- `S8_HOST_HTLC7_TIMEOUT_PASS`: seven expired HTLCs added, then timed out on
  both sides of every hop.
- Reconnect: B was killed and restarted while an A→B HTLC was pending; B
  recovered the pending HTLC and fulfilled it after restart.
- Concurrency: three HTLCs were added on A→B and all three fulfilled.

**Teardown blocker:** after coordinator restart, channels persist in SQLite but
the in-memory factory registry is empty, so `closeVirtualChannel` fails with
`Factory ... not found`. Factory state needs durable storage before teardown can
verify allocation restoration.

#### VTXO hardening and multiparty (2026-10-22/23)

Plan: [`VTXO_HARDENING_AND_MULTIPARTY_TEST_PLAN.md`](./VTXO_HARDENING_AND_MULTIPARTY_TEST_PLAN.md).

Hardening:

- H2 receipt security — PASS
- H3 funding proof presence/shape + verifier callback — PASS
- H4 durable restart — PASS
- H5 store-level one-time-use / no resurrection — PASS
- H6 live anchor/exit — PARTIAL: live anchor reached tx submission, but the
  private node could not provide a valid tip-depth pool-coin MMR proof and
  stopped auto-mining; exit not reached
- H7 pool conservation — PASS (omnia-pool 40/40)
- H8 host concurrent transfer/idempotency — PASS (omnia-host 95/95)

Multiparty:

- M1 six-owner fan-out — PASS
- M2 split + change conservation — PASS
- M3 chained ownership A→B→C — PASS
- M4 shared-store concurrent claim — PASS
- M5 operator-offline exits — PASS
- M6 stale root/epoch rejection — PASS
- M7 same-owner merge / cross-owner refusal — PASS
- M8 2-of-3 co-owned claim policy — PASS
- M9 conditional/escrow claim policy — PASS
- M10 DvP claim policy bound to HTLC id/hashlock/preimage — PASS

Test totals: `omnia-vtxo` **204/204**, `omnia-pool` **40/40**,
`omnia-host` **103/103**, `omnia-router` **79/79**, `omnia-relay` **29/29**,
`chain-provider` **47 passed / 4 skipped**. S8 payMultiHop rerun: `S8_PASS`.

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
| `@totemsdk/omnia-host` | 13 | 62 |
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

## Live E2E environment blocker (2026-10-20)

The OCI A1 instances are RUNNING and SSH/control planes are reachable, but
`getchaintip`/`coins` return nothing: the Minima node is not running and no
`minima`/`totem-node` binary is present on either host. The SDK/Omnia host and
the DHT seed are still running. Live S5 funding/close, S7 splice, and the S8
three-host run require redeploying the node (or a prebuilt binary) on both
hosts before they can be executed. SDK/host coordination and unit tests are
unaffected.

## Open issues / next gates

1. **S5 `closeFactory`** host plumbing and cooperative signing are in place
   (funding material, coin proof, proposal/accept/finalized; unit-tested). A live
   two-party on-chain funding/close run remains, including the funding-signature
   exchange.
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

### 2026-10-21 — AWS 8-node testbed

- 8 × `t4g.small` in `us-east-1`, private DHT through one seed on host A.
- Hosts: A–H on control ports `50052`–`50059`; node A runs a private `-test -solo`
  chain with a genesis coin.
- Ring S5 edges: A–B, B–C, C–D, D–E, E–F, F–G, G–H, H–A.
- Chord S5 edges: A–E, B–F, C–G, D–H.
- All listed S5 edges returned `S5_PASS`; S6/S10 host harnesses passed on AWS.
- S4 now uses the default `txnmine` path; the funding input is signed by the
  funding coin key (`fundingPubkey`) rather than the host channel key.
- S8 graph harness: `scripts/omnia-s8-graph.mjs`.
  - ring-only A→H: 7 hops
  - ring + chords A→H: 4 hops
  - all-pairs ring routes resolve
  - 7-hop fee-aware payment settles; recipient receives exactly `10000000000`.

**Executed 2026-10-21:** a true cross-host 7-hop value transfer across eight
non-custodial coordinator hosts. See “Non-custodial 7-hop and factory/VC (AWS
A–H)” above: `S8_HOST_HTLC7_PASS`, with seven edge VCs and 10k retained per hop.

**Recovery finding (fixed):** restarting a wallet service and then attempting an
HTLC produced `Double-sign detected: sequence 3 already signed with a different
payload`. Root cause: the in-process update watermark advanced before the async
wallet signature and was not released when signing failed, so a retry at the same
sequence with a different payload was rejected. `releaseUpdateGuard()` now rolls
back the watermark only for the matching failed attempt; regression test
`releases the watermark after a signing failure...` passes (omnia 237/237).
Live wallet-restart rerun is still pending.

### 2026-10-23 — Live non-custodial on hawk-node (OCI A)

**Node:** `hawk-node` `main` built from source (Docker linux/arm64,
`totem-node` v0.1.7) on `mash-a1-bench2` (79.72.84.151), `-mode edge -solo`
with a fresh data dir. First run creates the solo genesis coin
(1,000,000,000). This build includes the `TxPoWChecker::CURRENT_NETWORK`
cross-TU static-init fix (`org/minima/system/brains/tx_po_w_checker.cpp`), so
blocks are no longer rejected with `Wrong Block ChainID!` — the old v0.1.7
release lacked that fix.

**Coordinators:** two non-custodial `omnia-host` processes on A (control
50055/50056), each with a separate wallet service (51060/51061) and **no
`OMNIA_HOST_SEED`**. Native DHT via the real seed on `10.0.0.210:48860`; chain
RPC `http://127.0.0.1:9005`.

**Funding:** 100M from the solo genesis coin to wallet A (`0xc865…`); funding
coin `0x783D…`.

```text
NONCUSTODIAL_OPEN_PASS  channel 0x654e65ec80779f61f7bbe1972b965e56
funding tx 0x0003007A7E43570244C8BF7E57663908D48A851719C0F100BA6070FAD4B25872
initial 60,000,000 / 40,000,000; acknowledged=true; hostAHasSeed=false; hostBHasSeed=false

pay 5,000,000 -> 55,000,000 / 45,000,000 (both hosts sequence 1)
NONCUSTODIAL_SETTLE_PASS  settlement 0x0001E04A1D81E3396A8F0414A5C4EAA0FAEB9FC5ACCFD37C4BECA4E02B58F026
on-chain at block 101; final 55,000,000 / 45,000,000
```

**Observation:** both hosts served `/observe/snapshot` (cursor 78) and emitted
the channel transition events; the settlement is a main-chain block.

**Caveats / findings:**

- Both coordinators ran on A for this run (single-machine non-custodial split).
  Cross-host B is the next step.
- The relay transport on the host build timed out for both a direct two-client
  test and the host open; the successful run used native DHT. The relay path
  needs the shared connection-manager work (RFC-057 D2/D10/D11) or a matching
  published relay build.
- The host ran the workspace `@totemsdk/omnia` dist (current main) overlaid on
  the published 0.12.0 install; the bootstrap address must be the seed's bound
  interface (`10.0.0.210:48860`), not loopback.
- After `totem_omniaCloseChannel` on A, A's snapshot reports `closed` while B
  still reports `active`. Settlement is on-chain, so this is a local-status
  propagation gap (close is not sent to the counterparty), not a settlement
  failure.

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
| 2026-10-20 | S6 (host API) | in-memory | `06de2cc8` | PASS | host VTXO API + wallet receipts; `omnia-s6-host.mjs` |
| 2026-10-20 | S10 (host API) | in-memory | `06de2cc8` | PASS | host pool lifecycle + payout rooting; `omnia-s10-host.mjs` |
| 2026-10-20 | runtime | — | `d9ef523c` + Bare fix | PASS (Node/Bun/Bare) | `runtime-smoke.cjs`; Bun native skipped (upstream) |
| 2026-10-21 | S4 | native/txnmine | `702df648` | PASS | native funding signature fixed; settlement `0x0001304A…` |
| 2026-10-21 | S5 | native (AWS) | `702df648` | PASS | ring A-E-F-G-H-A + chords B-F/C-G/D-H; 100M/100M each |
| 2026-10-21 | S8 graph | in-memory | `omnia-s8-graph.mjs` | PASS | 8 nodes, 7-hop ring, 4-hop chord route, recipient exact |
| 2026-10-21 | S6 host | in-memory (AWS) | current dist | PASS | `omnia-s6-host.mjs`; VTXO lifecycle |
| 2026-10-21 | S10 host | in-memory (AWS) | current dist | PASS | `omnia-s10-host.mjs`; remaining 99000, rooted |
| 2026-10-21 | MCP | local node + host | `4e81067` | PASS | Omnia prepare/read tools in manifest; `tools/call` whoami/channels |
| 2026-10-21 | S8 HTLC (non-custodial) | native (AWS) | current dist | PASS | coordinator hosts + separate wallet services; 3-hop `S8_HOST_HTLC_PASS`; wallet-down negative |
| 2026-10-21 | S4 (non-custodial) | native (AWS) | current dist | PASS | `NONCUSTODIAL_OPEN_PASS`; `NONCUSTODIAL_SETTLE_PASS`; 60/40 → 55/45; on-chain settlement |
| 2026-10-21 | S5 factory/VC (non-custodial) | in-memory (AWS) | current dist | PASS | 7 edge factories/VCs; close restored 100M/100M allocations |
| 2026-10-21 | S8 7-hop (non-custodial) | native (AWS) | current dist | PASS | 8 coordinators; 7 VCs; `S8_HOST_HTLC7_PASS`; 10k fee/hop |
| 2026-10-21 | Non-custodial failure probe | native (AWS) | current dist | PASS | wallet-down fails closed; watermark release fixed; retry at same sequence succeeds |
| 2026-10-21 | HTLC timeout/refund (non-custodial) | native (AWS) | current dist | PASS | expired HTLC → `timed_out` on both hosts |
| 2026-10-21 | S6/S10 host APIs (non-custodial) | in-memory + chain check | current dist | PASS | `S6_S10_NONCUSTODIAL_PASS`; VTXO exit + pool deposit/allocate/release/withdraw |
| 2026-10-22 | VTXO hardening H2–H5/H7/H8 | in-memory | current dist | PASS | receipts/funding proof/durability/store spent-set/pool/host concurrency |
| 2026-10-22 | VTXO multiparty M1–M7 | in-memory | current dist | PASS | 6-owner fan-out, split/change, chained ownership, concurrent claim, offline exits, stale root, merge rules |
| 2026-10-23 | VTXO H6 live | native | current dist | BLOCKED | anchor proof depth one block short; private node stopped auto-mining; exit not reached |
| 2026-10-23 | VTXO M8–M10 | in-memory | current dist | PASS | 2-of-3 claim, conditional escrow, DvP policy binding |
| 2026-10-23 | S8 payMultiHop rerun | in-memory | current dist | PASS | `S8_PASS`; 3 hops, 10M/10M retained, recipient exact |
| 2026-10-22 | 7-hop timeout (non-custodial) | native (AWS) | current dist | PASS | seven expired HTLCs timed out on both sides |
| 2026-10-22 | Reconnect mid-HTLC | native (AWS) | current dist | PASS | B restart recovered pending HTLC and fulfilled |
| 2026-10-22 | Concurrent HTLCs | native (AWS) | current dist | PASS | 3 in-flight A→B HTLCs fulfilled |
| 2026-10-22 | 7-hop teardown | native (AWS) | current dist | BLOCKED | factory registry lost on restart; `Factory ... not found` |
| 2026-10-23 | S4 (non-custodial, hawk-node) | native DHT | current dist (omnia-host 0.12.0) | PASS | solo hawk-node genesis; `NONCUSTODIAL_OPEN_PASS` + `NONCUSTODIAL_SETTLE_PASS`; 60/40 → 55/45; settlement `0x0001E04A…` |

To add a run: append a row, then add the command, `OMNIA_RESULT` JSON, and log
paths under the relevant stage section. Re-run `scripts/omnia-{s4,s5}-cross.mjs`
with `--json` for a clean result line.
