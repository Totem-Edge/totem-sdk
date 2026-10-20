# Omnia test plan — SDK mirror (S1–S10)

**Status:** mirrored 2026-10-20 from the counterpart plan in the `hawk-node` repo
(`OMNIA_TEST_PLAN.md`). This copy is authoritative for the **SDK-side** harnesses,
results recording, and runtime portability; the node-side plan remains the source
for hawk-node build/spawn details.

**Scope:** drive the full `@totemsdk/omnia-*` family between two `omnia-host`
control planes, first over the relay transport and then over native Hyperswarm,
and record every run in [`OMNIA_TEST_RESULTS.md`](./OMNIA_TEST_RESULTS.md).

---

## 1. Packages under test

| Package | Role | Stage |
|---|---|---|
| `@totemsdk/omnia` | eltoo channel state machine, framing, peer/stream layer | S4 |
| `@totemsdk/omnia-host` | durable daemon: lifecycle, routing, control JSON-RPC | S1–S3 |
| `@totemsdk/omnia-factory` | N-of-N factory funding, virtual channels, settlement | S5 |
| `@totemsdk/omnia-vtxo` | virtual-UTXO / pool claims | S6 |
| `@totemsdk/omnia-splice` | splice in/out (live resize) | S7 |
| `@totemsdk/omnia-router` | multi-hop / cross-token routing | S8 |
| `@totemsdk/omnia-relay` | browser-safe relay transport | S9 |
| `@totemsdk/omnia-pool` | liquidity-pool orchestration | S10 |

The node (`hawk-node`) couples at runtime: it spawns `omnia-host` as a sidecar and
provides the chain RPC. It does not link the SDK at build time.

---

## 2. Topologies

### Relay
Both hosts set `OMNIA_RELAY=ws://<relay>:8899` (or `self-hosted` in the swarm
config) and no DHT environment. Used for S4/S5 smoke runs and any environment
where UDP is unavailable.

### Native Hyperswarm
Both hosts run with an explicit transport keypair and a DHT:

```sh
OMNIA_NATIVE_DIRECT=0
OMNIA_DHT_HOST=<private-ip>          # binds and pins the announced address
OMNIA_DHT_BOOTSTRAP=<seed-pubkey>@<seed-ip>:49737
```

Rules learned in S5 (implemented in `@totemsdk/omnia`):

- The bootstrap seed must be a **real DHT node**, not `DHT.bootstrapper(...)`.
  A bootstrapper does not route/store announces, so `lookup` returns nothing.
- Advertise is **server-only**; the initiator dials. Two `client:true` listeners
  create two sockets and hyperswarm tears the pair down repeatedly.
- On a reconnect, rebind the existing peer; never drop the new socket.
- Explicit `host` pins the announced address (NAT sampling can leave it null/0).
- `pubkey@host:port` bootstrap strings are normalised to `host:port` for dht-rpc.

Native transport identity is the ed25519 key derived from the host seed and
published in the signed manifest as `transportPubkey`; the PQ binding is the
manifest TreeSignature.

---

## 3. Harnesses

All harnesses live in `scripts/` and print a machine-readable
`OMNIA_RESULT {...}` line for the results log.

| Stage | Command | Requires |
|---|---|---|
| S4 | `node scripts/omnia-s4-cross.mjs` | two nodes + two hosts; funded coin; bearer token |
| S5 | `node scripts/omnia-s5-cross.mjs` | two hosts; factory lease bundles (host startup) |
| runtime | `node scripts/runtime-smoke.cjs [--native]` | SDK build; `OMNIA_SMOKE_HOST` for native |

### S4

```
NODE_A=http://127.0.0.1:9005 NODE_B=http://127.0.0.1:9015 \
HOST_A=http://127.0.0.1:50052/rpc HOST_B=http://127.0.0.1:50053/rpc \
MINIMA_RPC_PASSWORD=test RPC_TOKEN=test \
node scripts/omnia-s4-cross.mjs
```

Flow: `openChannel` (60/40 split of a spendable coin) → wait for `active` → `pay`
→ wait for the counterparty's sequence update → wait `contestDelay + 1` blocks of
channel-coin coinage → `settle` with a fresh `CoinProof` + `ScriptProof` →
`closeChannel`.

### S5

```
HOST_A=http://10.0.0.210:50052/rpc HOST_B=http://10.0.0.55:50053/rpc \
RPC_TOKEN=test OMNIA_TRANSPORT=native \
node scripts/omnia-s5-cross.mjs
```

Flow: `createFactory` (two 100M contributions) → `openVirtualChannel` (50M/50M)
→ `closeVirtualChannel`; asserts both allocations are restored to 100M.

### Runtime portability

```
node scripts/runtime-smoke.cjs
bun  scripts/runtime-smoke.cjs
bare scripts/runtime-smoke.cjs --no-encoding-shim
OMNIA_SMOKE_HOST=<LAN IP> node scripts/runtime-smoke.cjs --native
```

Bare has no `fs`, `TextEncoder`/`TextDecoder`, or `node:crypto`. The SDK now
falls back to the optional `bare-fs`/`bare-encoding` packages (applied by the
core-wasm post-build script) and patches `@noble/hashes` to make `node:crypto`
optional. `--no-encoding-shim` proves the SDK's own fallback rather than the
harness's.

---

## 4. Stages and gates

| Stage | Do | Gate | Status |
|---|---|---|---|
| **S1** | build `@totemsdk/omnia-host` (`dist/cli.js`) | CLI executable | done |
| **S2** | sidecar starts; control plane answers | `healthz`; `totem_omniaWhoami`; signed manifest | done |
| **S3** | two nodes on a shared chain, both hosts healthy | both at tip; both control planes healthy | done |
| **S4** | core channel lifecycle between two nodes | a channel payment settles on-chain | done |
| **S5** | factory + virtual-channel lifecycle | factory opens, VC opens/closes, allocations restore | done |
| **S6** | virtual-UTXO claims | claim settles | pending — no host methods yet |
| **S7** | splice in/out | live resize | pending — managers not wired into the CLI |
| **S8** | multi-hop / cross-token payment (3 nodes) | multi-hop settles | pending — needs 3 hosts + fee-adjusted per-hop amounts |
| **S9** | relay round-trip (SDK harness) | relay client/server round-trip | pending — formalise the `omnia-relay` client harness |
| **S10** | liquidity-pool orchestration | pool lifecycle | pending — SDK harness only |

S4+ mutations require signing material, a funded node, and chain RPC. Read-only
mode proves the API surface only.

---

## 5. Recording results (required for future runs)

Every run must be appended to `docs/OMNIA_TEST_RESULTS.md` with:

1. **Date** and stage.
2. **Transport** (relay/native) and topology.
3. **Commit(s)** for `totem-sdk` (and `hawk-node` where relevant).
4. **Environment** (hosts, ports, seed/transport keys, any env overrides).
5. **Command** and the `OMNIA_RESULT` JSON.
6. **Artifacts**: log paths on the hosts (e.g. `/tmp/host-a.log`) and failure
   stacks if any.

The run-log table at the bottom of the results doc is the index; detailed
evidence goes in the stage section. A run that is not recorded is treated as not
having happened.
