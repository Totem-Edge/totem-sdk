# Omnia settlement fabric — methods tracker

**Status:** living document, started 2026-10-23.
**Purpose:** for every live step, record the methods that best reveal what the
settlement fabric is doing, and what each method proved.
**Rule:** a run is only understood when the **chain**, **coordinator state**,
**observation journal** and **transport logs** agree. Never rely on one layer.

Related: [`OMNIA_TEST_RESULTS.md`](./OMNIA_TEST_RESULTS.md) (evidence),
[`OMNIA_TEST_PLAN.md`](./OMNIA_TEST_PLAN.md) (stages),
`Totem-Edge-Canary/docs/omnia-observer.md` (visualisation).

---

## 1. Layer map

| Layer | Authority | Primary methods |
|---|---|---|
| Chain | hawk-node RPC (`:9005`) | `getchaintip`, `status`, `txpow`, `block`, `coinexport`, `coins`, `balance`, `mempool` |
| Coordinator state | omnia-host JSON-RPC (`:50055/50056/rpc`) | `totem_omnia*` read + prepare/submit methods |
| Observation | omnia-host HTTP | `GET /observe/snapshot`, `GET /observe/events?after=<cursor>` |
| Custody boundary | wallet service (`:51060/51061`) | `/info`, `/sign`, `/lease/*` |
| Transport | DHT seed / relay + logs | `[swarm]`, `[peer]`, `ss`, seed `SEED_PUB`/`PORT` |
| Persistence | host SQLite + observation SQLite | restart probe, `/observe/snapshot` |
| Visual / replay | canary API + dashboard | `/api/canary/runs/:id/observe*`, Omnia Explorer |

---

## 2. Method catalog

### 2.1 Chain truth — hawk-node RPC

Auth: `curl -u minima:<OMNIA_CHAIN_RPC_PASSWORD>` (default `test`).

| Method | Reveals | Look for |
|---|---|---|
| `getchaintip` | tip block/hash/time | settlement tx hash becomes the tip |
| `status` | chain length, weight, MMR, coins, version | solo/test params; `Wrong Block ChainID` is a node bug |
| `txpow txpowid:<id>` | block/transaction inclusion | `isblock:true`, `istransaction:true`, nonce/difficulty |
| `block` | current block | advances after settlement |
| `coinexport coinid:<id>` | full coin proof | `coinproof.coin.created` → coinage; proof for funding/settlement |
| `coins` | wallet-owned coins | `confirmed`, `age`, `spent` |
| `balance` | confirmed/unconfirmed/sendable | `sendable` > 0 before funding |
| `mempool` | pending TxPoW | tx block appears before it is on-chain |
| `coincheck data:<proof>` | validates a coin proof | note: parameter is `data:`, not `coinid:` |
| `scanchain depth:<n>` | recent blocks | settlement tx included in a main-chain block |

```sh
curl -s -u minima:test -d 'getchaintip' http://127.0.0.1:9005
curl -s -u minima:test -d 'txpow txpowid:0x...' http://127.0.0.1:9005
curl -s -u minima:test -d 'coinexport coinid:0x...' http://127.0.0.1:9005
```

### 2.2 Coordinator control plane — omnia-host JSON-RPC

Auth: `authorization: Bearer <OMNIA_CONTROL_TOKEN>` and
`content-type: application/json`. Path: `/rpc`.

**Read**

| Method | Reveals |
|---|---|
| `totem_omniaWhoami` | identity, settlement address, custody mode, p2p hub |
| `totem_omniaGetManifest` | signed service manifest (transport binding) |
| `totem_omniaGetChannels` | local channel list |
| `totem_omniaGetChannelState` | status, sequence, balances, funding coin/tx, latest signed state, parties/transport keys |
| `totem_omniaGetRoute` / `totem_omniaGetSwapRate` | routing/fee view |

**Channel lifecycle**

| Method | Purpose |
|---|---|
| `totem_omniaPrepareOpenChannel` → `totem_omniaSubmitOpenChannel` | non-custodial two-phase open (prepare digest → wallet signs → submit) |
| `totem_omniaOpenChannel` | one-shot open (self-custody / local signer) |
| `totem_omniaPreparePay` → `totem_omniaSubmitPay`, `totem_omniaPay` | off-chain update |
| `totem_omniaPrepareSettle` → `totem_omniaSubmitSettle`, `totem_omniaSettle` | cooperative on-chain settlement |
| `totem_omniaCloseChannel` | local close/teardown |

**Factory / virtual channel**

`totem_omniaPrepareFactory` → `totem_omniaSubmitFactory`,
`totem_omniaCreateFactory`, `totem_omniaOpenVirtualChannel`,
`totem_omniaCloseVirtualChannel`, `totem_omniaCloseFactory`.

**Splice**

`totem_omniaPrepareSpliceIn` / `PrepareSpliceOut` → `totem_omniaSubmitSplice`,
`totem_omniaSpliceIn`, `totem_omniaSpliceOut`.

**HTLC**

`totem_omniaAddHTLC`, `totem_omniaFulfillHTLC`, `totem_omniaTimeoutHTLC`.

**VTXO**

`totem_omniaCreateVtxoPool`, `totem_omniaMintVtxo`, `totem_omniaTransferVtxo`,
`totem_omniaRefreshVtxo`, `totem_omniaInitiateVtxoExit`,
`totem_omniaCompleteVtxoExit`, `totem_omniaPrepareVtxoReceipt` →
`totem_omniaSubmitVtxoReceipt`.

**Liquidity pool**

`totem_omniaCreateLiquidityPool`, `totem_omniaDepositToPool`,
`totem_omniaAllocatePoolCapital`, `totem_omniaReleasePoolAllocation`,
`totem_omniaApprovePoolWithdrawal`, `totem_omniaExecutePoolPayout`,
`totem_omniaWithdrawPool`.

**Programs / counters**

`totem_omniaApplyProgramTransition`, `totem_omniaIncrementCounter`,
`totem_omniaDecrementCounter`, `totem_omniaSetCounter`,
`totem_omniaRecordMeterReading`.

Most have `omnia/*` aliases (e.g. `omnia/prepareOpenChannel`).

```sh
curl -s -H 'authorization: Bearer test' -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"totem_omniaGetChannelState","params":{"channelId":"0x..."}}' \
  http://127.0.0.1:50055/rpc
```

**Read gap:** there is no `totem_omniaGetFactories` / `GetVtxo` / `GetPool`
read method yet. Factory/VTXO/pool state is currently read from
`/observe/snapshot` or the host SQLite DB.

### 2.3 Observation fabric — the settlement timeline

| Route | Reveals |
|---|---|
| `GET /observe/snapshot` | projected `state` + `cursor`; `channels`, `factories`, `vtxoPools`, `vtxos`, `pools`, `operations` |
| `GET /observe/events?after=<cursor>` | SSE replay/live tail; events carry `id: <sourceSequence>`, `event: observation`; `Last-Event-ID` also accepted |
| `GET /api/canary/observe/latest` | newest canary run with an observation snapshot |
| `GET /api/canary/runs/:runId/observe` | canary projected snapshot |
| `GET /api/canary/runs/:runId/observe/events?after=<count>` | canary SSE replay + live tail |

```sh
curl -s -H 'authorization: Bearer test' http://127.0.0.1:50055/observe/snapshot
curl -N -H 'authorization: Bearer test' \
  'http://127.0.0.1:50055/observe/events?after=78'
```

What to compare:

- **A vs B snapshot**: `currentSequence`, `balances`, `status`, `fundingCoinId`,
  `latestState` hash.
- **Cursor gaps**: snapshot `cursor` vs first event `id`; reconnect with
  `after=cursor` must be gap-free.
- **Divergence**: after a close, A may report `closed` while B still reports
  `active` (local close is not propagated). This is visible only in the
  observation layer.

### 2.4 Custody boundary — prove non-custodial

| Route | Reveals |
|---|---|
| `GET /info` | `publicKeyDigest` (WOTS), `transportPubkey`, `address`, `addressHex`, `fundingScript`, `addressIndex` |
| `POST /sign` | signature over a digest at leased WOTS indices |
| `POST /lease/reserve` | WOTS index reservation (purpose, payload hash) |
| `POST /lease/commit` / `burn` | reservation finalisation |
| `POST /lease/watermark` / `publish` / `sync` / `verify` | double-sign/watermark state |

Proof checks:

1. Host processes have **no** `OMNIA_HOST_SEED` / `OMNIA_HOST_KEYFILE`.
2. `whoami` shows the wallet's `publicKeyDigest`; host only holds the transport
   key pair.
3. Stop the wallet, call `totem_omniaPay` → it must fail (host cannot sign).
4. `lease/*` entries show the funding/update reservations.

### 2.5 Transport diagnostics

| Signal | Meaning |
|---|---|
| `dht-seed.mjs` prints `SEED_PUB … PORT …` | real DHT seed; bootstrap must use the **bound interface** (e.g. `10.0.0.210:48860`), not `127.0.0.1` |
| `ss -lun` shows `OMNIA_DHT_PORT` | DHT actually bound |
| `[swarm] advertise <topic> pubkey <wots>` | participant rendezvous topic (WOTS digest) |
| `[swarm] join <topic> expect <transport>` | initiator dials the peer topic; `expect` is the transport key |
| `[peer] resend … no reply` | stream opened but no counterparty response |
| `Peer connection timeout for <transport>` | no transport connection (topic/bootstrap mismatch) |
| `[jsonrpc] … not found` | counterparty never received the proposal |

Identity rules:

- `OMNIA_LOCAL_PUBKEY` = **participant WOTS digest** (advertised topic).
- `REMOTE_TRANSPORT` / `remoteTransportPubkey` = **transport** pubkey
  (authenticated stream).
- Relay and native DHT both need the advertiser and dialer on the same topic.

Known current issue: the relay transport times out on the published host build
(direct two-client test and host open); native DHT works. Track as
RFC-057 D2/D10/D11 work.

### 2.6 Persistence / restart

| Probe | Reveals |
|---|---|
| Restart a coordinator, re-query `GetChannelState` | channel survives (storage) |
| `/observe/snapshot` after restart | `factories`, `vtxos`, `pools` survive (`PersistentMap`, host-state format) |
| `CloseVirtualChannel` after restart | factory registry was restored, not lost |
| `OMNIA_HOST_DB` / `observe.sqlite` | local durable authority (never Hypercore) |

### 2.7 Canary / visual

| Artifact | Reveals |
|---|---|
| `artifacts/observe.jsonl` | one `OmniaObservation` per line (replay source) |
| `artifacts/observe.snapshot.json` | projected state + cursor |
| `OmniaObserver` | reducer: channels, factories, VTXOs, pools, transport transitions |
| `/omnia` Explorer | topology, timeline, replay, inspector |

Scenarios: `43-omnia-observe` (synthetic) and `44-omnia-noncustodial-live`
(env-gated; runs SDK harnesses + host/MCP observation).

### 2.8 Logs and process forensics

| Log | Key lines |
|---|---|
| hawk-node `node-a.log` | `Genesis block created`, `NEW Unspent/Spent Coin`, `ASYNC/SYNC Transaction Mined`, `Wrong Block ChainID` |
| coordinator `nc-a.log` / `nc-b.log` | `[omnia-stream] send`, `[peer] resend`, `[jsonrpc] handler error` |
| wallet `wallet-a.log` | `[wallet] <digest> listening`, signing/lease errors |
| DHT `dht-seed.log` | `SEED_PUB`, `PORT` |
| relay `relay.log` | relay URL / client count |

```sh
ss -lun | grep -E '49738|49739|48860'
ss -tnp | grep 8899
pgrep -af 'totem-node|omnia-host|omnia-noncustodial|wallet-service|dht-seed'
```

---

## 3. Question → best method

| Question | First method | Then confirm with |
|---|---|---|
| Is the chain healthy / mining? | `getchaintip` | `status`, node log `Transaction Mined` |
| Is the funding coin spendable? | `coinexport` + `balance` | `coins` (`confirmed`, `age`), `getchaintip` |
| Did settlement hit chain? | `txpow txpowid:` | `getchaintip` hash, `block`, `status.length` |
| Do both coordinators agree? | `GetChannelState` A + B | `/observe/snapshot` A + B (`sequence`, `balances`, `status`) |
| Did a message stall? | `[peer] resend` / `Peer connection timeout` | `[swarm] join` vs `advertise`, `ss -lun`, seed bootstrap |
| Is the host non-custodial? | wallet `/info` + host env | wallet-down negative, `/lease/*` |
| Did state survive restart? | restart + `GetChannelState` | `/observe/snapshot` factories/VTXOs/pools |
| What is the full topology/timeline? | `observe.jsonl` / SSE | canary Explorer, `observe.snapshot.json` |
| Did close propagate? | A/B `GetChannelState` | A/B `/observe/snapshot` (known gap: B stays `active`) |
| Was the settlement cooperative? | `GetChannelState.latestState.signatures` | `txpow` witness, both party settlement addresses |

---

## 4. Current gaps / methods still needed

1. **Read methods for factory/VTXO/pool state** — use `/observe/snapshot` until
   `GetFactories`/`GetVtxo`/`GetPool` exist.
2. **Close propagation** — A closes, B stays `active`; settlement is on-chain.
   Needs a `CHANNEL_CLOSE`/state-update message to the counterparty and a
   cross-host assertion.
3. **Relay transport** — published host build times out; native DHT is the
   working path. Needs the shared connection manager (RFC-057 D2/D10/D11).
4. **Cross-host run** — **done** 2026-10-23 on AWS A/B (see run log). Remaining:
   restart/mid-channel recovery and close propagation.
5. **MCP snapshot** — `HAWK_NODES` / `McpSnapshotSource` has not been exercised
   against this live hawk-node build.
6. **Single settlement trace** — correlate `channelId` + `fundingTxId` +
   `settlementTxId` + `operationId` across chain, host and observation; no
   single method joins all four yet.

---

## 5. Run log (append one entry per step)

Template:

```text
### YYYY-MM-DD — <step>
- Goal:
- Topology:
- Methods used:
- Evidence:
- What it proved:
- What it did not prove / next:
```

### 2026-10-23 — live non-custodial open → pay → settle (hawk-node, OCI A)

- **Goal:** repeat the non-custodial lifecycle on current hawk-node.
- **Topology:** hawk-node `-mode edge -solo` on A; coordinators 50055/50056;
  wallets 51060/51061; native DHT seed `10.0.0.210:48860`; chain RPC 9005.
- **Methods used:** `getchaintip`, `status`, `coinexport`, `balance`, `txpow`;
  `totem_omniaWhoami`, `PrepareOpenChannel`/`SubmitOpenChannel`,
  `GetChannelState`, `Pay`, `Settle`, `CloseChannel`; `/observe/snapshot`;
  wallet `/info`, `/sign`, `/lease/reserve|commit`; node/coordinator/wallet logs.
- **Evidence:** `NONCUSTODIAL_OPEN_PASS` (channel `0x654e…`, 60/40),
  `NONCUSTODIAL_SETTLE_PASS` (settlement `0x0001E04A…`, block 101), snapshot
  cursor 78 on both hosts.
- **What it proved:** current hawk-node solo chain + non-custodial coordinator
  split + native DHT + on-chain settlement; no host seeds.
- **What it did not prove / next:** cross-host B; close propagation (B still
  `active`); relay transport; MCP observation. See §4.

### 2026-10-23 — cross-host non-custodial open → pay → settle (AWS A/B)

- **Goal:** repeat the non-custodial lifecycle across two AWS hosts.
- **Topology:** AWS `t4g.small` A (`172.31.68.246`) and B (`172.31.74.14`) in
  `omnia-aws-test`; A runs the funded `-test -solo` hawk-node on RPC 9029,
  B reaches it over the private network. Coordinators 50055/50056; wallets
  51060/51061; DHT seed `8146640f…@172.31.68.246:49737`; A 49738, B 49739.
- **Methods used:** `getchaintip`, `balance`, `coinexport`, `txpow`;
  `totem_omniaWhoami` (cross-host), `PrepareOpenChannel`/`SubmitOpenChannel`,
  `GetChannelState` (A and B), `Pay`, `Settle`, `CloseChannel`;
  `/observe/snapshot` on both hosts; wallet `/info`, `/sign`, `/lease/*`.
- **Evidence:** `NONCUSTODIAL_OPEN_PASS` (channel `0x27ba…`, funding tx
  `0x0003BA1D…`, 60/40, acknowledged, no seeds); pay 5M → 55/45;
  `NONCUSTODIAL_SETTLE_PASS` (settlement `0x00028566…`).
- **Observation:** A cursor 31, `closed`, seq 1, 55/45; B cursor 5, `active`,
  seq 1, 55/45. Balances and sequence agree; B did not receive the close.
- **What it proved:** cross-host private-network control, native-DHT peer
  connection, two-phase non-custodial open and cooperative on-chain settlement
  between separate hosts.
- **What it did not prove / next:** close propagation (B still `active`);
  mid-channel restart/recovery; relay transport; MCP observation. The two
  observation streams are per-node — compare both, never assume one is global.
