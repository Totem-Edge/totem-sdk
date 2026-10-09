# RFC-034 — Omnia Relay Method Parity (Phase A: Single-Party Operations)

**Status:** Draft — design specification
**Created:** 2026-10-08
**Revised:** 2026-10-08 (corrected method taxonomy — see §1.1)
**Authors:** Totem SDK Contributors
**Depends on:** RFC-014 (wallet connect parity), RFC-014 Amendment A (manifest truthfulness), RFC-002 (Omnia Rust/WASM parity), RFC-013 (wallet self-hosted mode)
**Touches:** `@totemsdk/omnia` (`relay` subpath), `@totemsdk/omnia-router`, `@totemsdk/omnia-factory`, `@totemsdk/omnia-splice`, `@totemsdk/connect` (`wallet`), wallet bootstraps

> RFC-014 §6.3 routes the Omnia family through a consent-gated SDK client and
> requires every method to be `supported` or an explicit `unsupported`. Today the
> browser-safe relay client (`packages/omnia/src/relay-client.ts`) implements
> `getChannels`/`openChannel`/`pay`/`settle`/`closeChannel`; it returns an explicit
> `UNSUPPORTED` for seven more (`ADVANCED_UNSUPPORTED`) and does not implement
> `payMultiHop` at all. This RFC specifies **Phase A**: wire every method a single
> wallet can drive with only its own signing material — read-only queries and
> single-party constructors/proposers — with no change to the peer wire protocol.
> Methods that require **another party's** co-signature are Phase B (RFC-035).

---

## 1. Summary

The Omnia connect family is **13 methods**. The relay client serves **5** today.
It explicitly refuses **7** (`getRoute`, `getSwapRate`, `createFactory`,
`openVirtualChannel`, `closeFactory`, `spliceIn`, `spliceOut`) and silently lacks
`payMultiHop`. Those 8 unserved methods are **not** one class — they split by
**who must sign**:

- **Read-only** — no signing: `getRoute`, `getSwapRate`.
- **Single-party** — only the local wallet signs (its own lease + signer), and it
  may move value on-chain: `createFactory`, `spliceIn`, `spliceOut`.
- **Multi-party** — an **additional** party's signature is structurally required,
  so no single wallet can complete them without a peer round-trip:
  `openVirtualChannel` (N-of-N), `closeFactory` (N-of-N), `payMultiHop`
  (per-hop counterparty), and the splice *accept/finalize* half.

Phase A (this RFC) serves the read-only and single-party methods. Phase B
(RFC-035) serves the multi-party methods.

### 1.1 Corrected taxonomy

An earlier draft of this RFC grouped all six as “local or read-only.” That was
wrong: only two are read-only, and `createFactory` mines and broadcasts a real
funding transaction. The verification is in §3.3.

| Connect method | Phase | Signers required | On-chain effect | Source |
|---|---|---|---|---|
| `totem_omniaGetRoute` | **A** | none | none | `omnia-router` `findRoute`/`findCrossTokenRoute` |
| `totem_omniaGetSwapRate` | **A** | none | none | `omnia-router` `getSwapAnnouncements` |
| `totem_omniaCreateFactory` | **A** | local proposer (1 bundle) | **yes — mines + broadcasts funding TxPoW** | `omnia-factory` `createFactory` |
| `totem_omniaSpliceIn` | **A** | local proposer (1 lease) | no (proposal only) | `omnia-splice` `proposeSpliceIn` |
| `totem_omniaSpliceOut` | **A** | local proposer (1 lease) | no (proposal only) | `omnia-splice` `proposeSpliceOut` |
| `totem_omniaOpenVirtualChannel` | **B** | **all N** participants | no | `omnia-factory` `openVirtualChannel` (`collectNofN`) |
| `totem_omniaCloseFactory` | **B** | **all N** participants | **yes — settlement Tx** | `omnia-factory` `closeFactory` |
| `totem_omniaPayMultiHop` | **B** | local + per-hop counterparty | no (state updates) | `omnia-router` `executeMultiHopPayment` |
| `totem_omniaSpliceIn/Out` accept+finalize | **B** | proposer + acceptor | **yes — splice Tx** | `omnia-splice` `acceptSplice`/`finalizeSplice` |

Phase A delivers real, testable behaviour for **5** methods (the 2 read-only + 3
single-party), leaving the other 8 explicitly `unsupported`-with-reason in the
manifest (RFC-014 Amendment A) until Phase B.

## 2. Motivation

- dApps and the shared wallet runtime advertise 13 Omnia methods; the browser
  path can perform 5. The gap is not conceptual (the operations exist and are
  tested) — it is that the relay client never calls them.
- The Node host (`@totemsdk/omnia-host`) already exposes all of these over JSON-RPC
  with real implementations (`packages/omnia-host/src/api/methods.ts`), proving
  the underlying functions work end to end.
- The router/factory/splice packages are **browser-safe**: no Hyperswarm, no
  SQLite, no `node:*` runtime imports (factory uses `@totemsdk/core/wasm` +
  `@totemsdk/txpow`, both already in the extension bundle; splice uses
  `tx-builder`/`txpow`/`wots-lease`). The only reason they are absent is that the
  relay client was scoped to the base channel lifecycle.

> **The Node host is a single-party model, not P2P parity.** The host holds every
> participant's `factoryBundles` and the operator's own `leaseProvider`, so it can
> call `collectNofN` (all N bundles) and `executeMultiHopPayment` (one lease per
> hop) synchronously. A browser wallet holds only **its own** keys. That is
> precisely why the N-of-N and per-hop methods are Phase B: the extra signing
> material must be obtained from peers over the wire (RFC-035), not conjured from
> a local map.

## 3. Current state (verified)

`packages/omnia/src/relay-client.ts`:

- `ADVANCED_UNSUPPORTED = { getRoute, getSwapRate, createFactory,
  openVirtualChannel, closeFactory, spliceIn, spliceOut }` — seven methods that
  return an explicit `UNSUPPORTED`.
- `createRelayOmniaOperations` implements only `openChannel`/`pay`/`settle`/
  `closeChannel`.
- The returned `RelayOmniaClient` does **not** implement `payMultiHop` at all —
  it is neither wired nor listed in `ADVANCED_UNSUPPORTED`. So **8** of 13 methods
  are unserved, not 7.
- `OmniaClientPort` (`packages/connect/src/wallet.ts:359`) declares all methods
  **optional**, so `RelayOmniaClient` is already type-assignable to it despite the
  missing `payMultiHop`. “Structural conformance” is therefore *not* the gap; the
  gap is that `buildWalletCapabilityManifest` marks all 13 `supported` from mere
  port presence (the defect addressed by RFC-014 Amendment A). Phase A does not
  need to add members to satisfy the type — it should still implement
  `payMultiHop` explicitly so it returns a reasoned `UNSUPPORTED` rather than
  being absent (undefined), which is what makes the manifest truth fix tractable.

### 3.3 Who signs each operation (verified)

- `createFactory(participants, tokenId, bundle, chainProvider, …)`
  (`packages/omnia-factory/src/factory.ts:155`) takes a **single** `WotsLeaseBundle`
  (the proposer's) and, when all participants supply `fundingCoinId` + a
  `chainProvider`, calls `mineTxPoW(...)` and `chainProvider.broadcastTxPoW(...)`
  (`:206-208`). It is **single-party and on-chain**.
- `acceptFactory(factory, bundle)` (`:277`) is the counterparty half; when all N
  have signed it `commitOpening`s. **Multi-party.**
- `openVirtualChannel(...)` (`packages/omnia-factory/src/virtual.ts:97`) calls
  `collectNofN(...)` which requires **all N** `WotsLeaseBundle`s (`factory.ts:87`).
  **Multi-party**, no on-chain TX.
- `closeFactory(factory, leaseProviders, chainProvider)`
  (`packages/omnia-factory/src/settlement.ts:40`) requires **all N** bundles and
  broadcasts a settlement TxPoW. **Multi-party, on-chain.**
- `proposeSpliceIn/Out(...)` (`packages/omnia-splice/src/splice.ts:161,231`) take a
  **single** `SpliceLeaseProvider`, reserve one index, and return a signed
  `SpliceProposal` — no broadcast. **Single-party.** `acceptSplice` (`:333`) and
  `finalizeSplice` (`finalize.ts:225`, which mines/broadcasts) are the other half.
  **Multi-party.**
- `executeMultiHopPayment(ops, channels, route, paymentRequest, leaseProviders)`
  (`packages/omnia-router/src/execute.ts:70`) needs a `LeaseProvider` **per hop**
  (`:73`) and locks HTLCs on each channel. **Multi-party.**

### 3.4 The “already served 5” are not all settlement-complete

The 5 methods the relay client claims to serve are not equally sound; two deserve
scrutiny here because Phase A sits next to them:

- `settle` (`packages/omnia/src/relay-client.ts:185`) calls `proposeSettlement`,
  which — when given a `chainProvider` — serializes the witness with **a single**
  signature (`settlement.ts:172`: `signatures: [encodeSettlementWitness(signature, indices)]`)
  and broadcasts. But the on-chain script is `MULTISIG(2 pkA pkB)`
  (`packages/omnia/src/script.ts:30`). A one-signature settlement broadcast would
  be **rejected by consensus**. So `settle` is a *local/unilateral* attempt, not a
  valid cooperative settlement; the second signature is another Phase B
  round-trip. This RFC documents it and does **not** count `settle` as
  settlement-complete.
- `closeChannel` (`relay-client.ts:208`) only flips the in-memory status to
  `closed` (`markChannelClosed`) — it broadcasts nothing. It is a **local state
  marker**, not an on-chain close.

Therefore Phase A's honest claim is: it makes `getRoute`/`getSwapRate` fully work,
and `createFactory`/`spliceIn`/`spliceOut` produce their single-party half. The
“13/13 served” impression is false until Phase B; RFC-014 Amendment A makes the
manifest say so.

### 3.5 Reconciling the counts

| Bucket | Connect methods | Served today | After Phase A |
|---|---|---|---|
| Relay client wired | `getChannels`, `openChannel`, `pay`, `closeChannel`, `settle` | 5 (of which `closeChannel` is a local marker and `settle` is not settlement-complete, §3.4) | 5 (unchanged) |
| Phase A | `getRoute`, `getSwapRate`, `createFactory`, `spliceIn`, `spliceOut` | 0 | **5** |
| Phase B | `openVirtualChannel`, `closeFactory`, `payMultiHop` | 0 | 0 (reasoned `UNSUPPORTED`) |
| **Total** | **13** | **5** | **10 served + 3 reasoned** |

Available, tested building blocks:

- `omnia-router`: `createChannelGraph`, `addChannel`, `getSwapAnnouncements`,
  `findRoute`, `findCrossTokenRoute`, `executeMultiHopPayment`,
  `executeCrossTokenPayment`.
- `omnia-splice`: `proposeSpliceIn`, `proposeSpliceOut`, `acceptSplice`,
  `finalizeSplice`, `quiesceChannel`.
- `omnia-factory`: `createFactory`, `acceptFactory`, `openVirtualChannel`,
  `closeFactory`, `reallocate`.

## 4. Goals

1. Serve the Phase A methods from the browser-safe relay client: `getRoute`,
   `getSwapRate` (read-only) and `createFactory`, `spliceIn`, `spliceOut`
   (single-party).
2. Implement `payMultiHop` **explicitly** (returning a reasoned `UNSUPPORTED`
   until Phase B) so no method is silently absent.
3. No change to `OmniaMessageType` or the Axia relay contract (RFC-035 owns that).
4. Every Phase B method returns an explicit `UNSUPPORTED` with a reason, surfaced
   truthfully in the manifest (RFC-014 Amendment A).
5. Reuse the existing packages verbatim; the relay client is glue, not a
   reimplementation.
6. **Approval-gate the single-party mutators** (`createFactory`, `spliceIn`,
   `spliceOut`): `createFactory` moves value on-chain and must never run without
   consent (RFC-014 §6.3).

## 5. Non-goals

- Multi-party coordination — factory/VC N-of-N, factory close, splice
  accept/finalize, and multi-hop execution (Phase B, RFC-035).
- A wallet-resident routing **gossip** protocol; Phase A consumes a graph the
  wallet supplies (see §6.1).
- Changing Omnia channel state-machine semantics (RFC-002) or the on-chain
  scripts.

## 6. Design

### 6.1 A wallet-supplied channel graph

Routing needs a graph. The relay client cannot invent one; a thin wallet sees
only its own channels. Add an optional, injected `routing` source to
`RelayOmniaClientOptions`:

```ts
export interface RoutingPort {
  /** Current known channel edges (own + announced). */
  snapshot(): Iterable<ChannelGraphEdge>;
  /** Subscribe to changes; returns an unsubscribe fn. */
  subscribe?(onChange: () => void): () => void;
  /** Optional announced cross-token swaps. */
  swaps?(): readonly SwapAnnouncement[];
}
```

Sources, in preference order:

1. A **host-supplied** graph (a self-hosted relay sidecar, RFC-013) — full
   topology.
2. The wallet's **own channels** (`channelGraphEdges(channels)`, already exported
   by `omnia-host`'s routing provider) — single-node view; routes only through
   the local node, sufficient for `getRoute` to self and immediate peers.
3. Absent entirely ⇒ `getRoute`/`getSwapRate` return an explicit `UNSUPPORTED`
   (reason: “no routing graph configured”).

This keeps the RFC-014 port model (structural, host-injected) and avoids
inventing a network service in this RFC.

### 6.2 Read-only methods

```ts
async getRoute(params) {
  const graph = buildGraph(routing);            // §6.1
  if (!graph) return unsupported('No routing graph configured.');
  const route = params.targetTokenId
    ? findCrossTokenRoute(graph, reqString(params,'fromPartyId'), reqString(params,'toPartyId'),
        reqBigInt(params,'amount'), reqString(params,'tokenId'), reqString(params,'targetTokenId'),
        { maxHops: intOpt(params,'maxHops') })
    : findRoute(graph, reqString(params,'fromPartyId'), reqString(params,'toPartyId'),
        reqBigInt(params,'amount'), reqString(params,'tokenId'), { maxHops: intOpt(params,'maxHops') });
  if (!route) return { success: false, error: 'No route found', errorCode: 'ROUTE_NOT_FOUND' };
  return { success: true, route: serializeRoute(route) };
}

async getSwapRate(params) {
  const graph = buildGraph(routing);
  if (!graph) return unsupported('No routing graph configured.');
  const announcements = getSwapAnnouncements(graph, reqString(params,'tokenIn'), reqString(params,'tokenOut'));
  return { success: true, announcements: announcements.map(serializeSwap) };
}
```

Response shapes mirror the Node host's `totem_omniaGetRoute`/`totem_omniaGetSwapRate`
(`packages/omnia-host/src/api/methods.ts:240,273`) so the two front-ends agree.

### 6.3 `payMultiHop` — Phase B, but present as an explicit refusal

`executeMultiHopPayment` needs a `LeaseProvider` **per hop** (`execute.ts:73`) —
i.e. the counterparty's signing material, which a single wallet does not hold.
Phase A therefore implements `payMultiHop` **only to return a reasoned
`UNSUPPORTED`**, so the method is no longer silently absent:

```ts
async payMultiHop() {
  return unsupported('Omnia payMultiHop requires per-hop counterparty signing (Phase B, RFC-035).');
}
```

Real multi-hop execution (locking HTLCs across each hop, revealing the preimage)
is Phase B. A **local** single-channel `pay` already exists; multi-hop is what
needs the peer round-trip.

### 6.4 `createFactory` — single-party, on-chain, approval-gated

`createFactory` takes only the proposer's `WotsLeaseBundle` and, when all
participants supply `fundingCoinId` + a `chainProvider`, mines and broadcasts the
funding TxPoW (`factory.ts:206-208`). This is the one Phase A method that moves
value on-chain, so it is **approval-gated** and must never run silently:

```ts
async createFactory(params) {
  if (!operations) return unsupported('Omnia createFactory requires wallet signing material.');
  const participants = parseParticipants(params.participants);   // FactoryParticipant[]
  const bundle = factoryBundles.get(localParticipant.publicKeyDigest);
  if (!bundle) return unsupported('No local factory lease bundle for this participant.');
  const factory = await createFactory(participants, reqString(params,'tokenId'), bundle,
    chainProvider, intOpt(params,'tokenScale') ?? 0);
  factories.set(factory.factoryId, factory);
  // The factory is now status:'opening' and the funding UTXO is spent.
  // Collecting the N-of-N acceptances (acceptFactory) is Phase B (RFC-035).
  return { success: true, factoryId: factory.factoryId, fundingTxId: factory.fundingTxId,
           status: factory.status };
}
```

> **Phase boundary.** `createFactory` alone produces an **`opening`** factory
> whose funding TX is already broadcast — it is not usable until all N parties
> accept (Phase B). The method is honest about that: it returns `status:'opening'`
> and the manifest reason states the accept round-trip is not yet available. It
> is **not** a completed factory, and it is **not** “read-only.”

### 6.5 Splice proposers — single-party (proposal only)

`proposeSpliceIn`/`proposeSpliceOut` take a **single** `SpliceLeaseProvider`, and
require a **quiesced** channel. They reserve one index and return a signed
`SpliceProposal` — no broadcast. Phase A serves the proposer half:

```ts
async spliceIn(params) {
  if (!operations) return unsupported('Omnia spliceIn requires wallet signing material.');
  const channel = channels.get(reqString(params,'channelId'));
  if (!channel) throw new Error(`Channel ${params.channelId} not found`);
  const quiesced = await quiesceChannel(channel, spliceLeaseProvider); // throws if HTLCs pending
  const proposal = await proposeSpliceIn(quiesced, reqString(params,'additionalCoinId'),
    reqBigInt(params,'additionalAmount'), spliceLeaseProvider);
  spliceProposals.set(proposal.spliceId, proposal);
  return { success: true, spliceId: proposal.spliceId, spliceTxHex: proposal.spliceTxHex,
           proposerSignature: proposal.proposerSignature };
}
```

`spliceOut` is symmetric via `proposeSpliceOut`. The on-chain half —
`acceptSplice` + `finalizeSplice` (which mines/broadcasts and commits/burns leases)
— requires the acceptor and is Phase B (RFC-035). A proposal that is never
accepted is abandoned and its reserved index burned.

### 6.6 Explicit refusals for the Phase B surface

`createRelayOmniaClient` must expose **all 13** `OmniaClientPort` methods so that
none is silently absent. Counting the 5 already served, Phase A brings the served
total to **10** and returns a reasoned `UNSUPPORTED` for the remaining **3**
(`openVirtualChannel`, `closeFactory`, `payMultiHop`), with `supports()`
(RFC-014 Amendment A) reporting the truth table. (The factory-accept and
splice-accept/finalize round-trips are protocol halves of `createFactory` and
`spliceIn/Out`, not separate port members; they do not change the 13-method count.)
“Structural conformance” is not the goal here — `OmniaClientPort` members are all
optional, so the current client already type-checks; the goal is that every method
**answers**.

## 7. Dependency graph

```text
relay-client → omnia-router (graph, route, swap announcements)
             → omnia-factory (createFactory)
             → omnia-splice (proposeSpliceIn/Out, quiesce)
             → omnia (channel, integration, relay)   [already]
connect/wallet → (structural port only; no concrete dep)  [unchanged]
```

`openVirtualChannel`/`closeFactory`/`payMultiHop` are **not** wired in Phase A and
therefore add no `omnia-router`/`omnia-factory` execution dependency beyond
`createFactory`. No new package, no new subpath. `@totemsdk/omnia/relay` already
exists; its bundle grows by the browser-safe code the Phase A methods use.

## 8. Security & privacy

- **No new trust.** Phase A adds no message kind and no new inbound handling; no
  peer can trigger a Phase A method.
- **No raw keys.** All signing goes through the injected `ChannelSigner` +
  `WotsLeaseProvider` (RFC-013); one-time indices are leased, never reused.
- **Routing graph is not a trust input.** `getRoute` treats edges as hints; the
  actual payment still requires each counterparty's co-signature, so a lying graph
  cannot move funds.
- **`createFactory` moves value.** It broadcasts a funding TxPoW spending every
  participant's `fundingCoinId`; it is approval-gated and returns
  `status:'opening'` (not a completed factory) until Phase B acceptances exist.
- **Splice proposers reserve an index.** An unaccepted proposal must burn its
  reservation; Phase A must not leak indices on abandonment.
- **Consent preserved.** Mutating methods keep `requiresApproval` (RFC-014 §6.3).
- **Fail-closed.** Absent signing material or graph ⇒ explicit `UNSUPPORTED`,
  never a silent success.

## 9. Phasing

- **A0** — `RoutingPort` + graph builder; `getRoute`/`getSwapRate`; response
  serializers matching the Node host.
- **A1** — `createFactory` (single-party, on-chain, approval-gated), returning an
  `opening` factory.
- **A2** — `spliceIn`/`spliceOut` proposers (quiesce + propose + burn-on-abandon).
- **A3** — explicit reasoned `UNSUPPORTED` for all 8 Phase B methods (including a
  present, non-absent `payMultiHop`); `supports()` truth table; flip the relay
  tests from “UNSUPPORTED everywhere” to assertions on real output for Phase A and
  reasons for Phase B.
- **A4** — extension/PWA inject a routing source and their truth table; manifest
  reflects Phase A support and Phase B gaps (RFC-014 Amendment A).

## 10. Acceptance / verification

- `relay-client.test.ts` asserts real results for each Phase A method
  (`getRoute`/`getSwapRate`/`createFactory`/`spliceIn`/`spliceOut`) against a
  constructed graph/channel, an explicit reason when the graph/signing material is
  absent, and a **reasoned** `UNSUPPORTED` for each Phase B method — including
  `payMultiHop`, which today is absent rather than refusing.
- `getRoute` output is shape-identical to the Node host's `totem_omniaGetRoute`.
- Every `OmniaClientPort` method is **present and answers** (supported or reasoned
  unsupported) — no method is `undefined`.
- The RFC-014 Amendment A truthfulness test passes: no method marked `supported`
  returns `UNSUPPORTED` for a well-formed request.
- `verify:wallets` (extension tsc + self-hosted tests) stays green.

## 11. Risks

| Risk | Mitigation |
|---|---|
| Routing without a gossip source yields empty graphs | §6.1 source ladder; explicit `UNSUPPORTED`, never a wrong route |
| `createFactory` broadcasts funding but Phase B cannot collect acceptances | Return `status:'opening'`; document that the funding UTXO is spent and acceptance is Phase B; RFC-035 defines the abort/burn path |
| Splice proposal abandoned, index leaked | Burn the reservation on abandon (§8); test it |
| Bundle growth in the extension | Browser-safe imports only; measure against the extension size budget (RFC-031 G4) |

## 12. Open questions

1. **Routing source for a thin wallet.** Own-channels only, or does the Axia
   relay/host expose a routing query the wallet can use as source (2)? (Ties to
   RFC-035 and RFC-015.)
2. **`getSwapRate` semantics.** Return local announcements only, or query a host
   for a market rate when none are known?
3. **Approval granularity.** Should `spliceIn`/`createFactory` each be one approval
   or a two-step (propose → confirm) consent?
4. **Shipping `createFactory` before Phase B.** Is an `opening`-only factory with
   a spent funding UTXO acceptable to expose, or should `createFactory` also be
   deferred behind Phase B so it is never half-complete?

## 13. References

- RFC-014 §6.3–6.5; RFC-014 Amendment A (capability manifest truthfulness)
- RFC-035 (Omnia peer coordination — Phase B)
- RFC-002 (Omnia Rust/WASM parity), RFC-003 (built-in programs), RFC-013 (self-hosted)
- `packages/omnia/src/relay-client.ts`, `packages/omnia/src/messaging-types.ts`
- `packages/omnia-router/src/{graph,pathfind,execute}.ts`
- `packages/omnia-factory/src/{factory,virtual}.ts`
- `packages/omnia-splice/src/{splice,quiesce}.ts`
- `packages/omnia-host/src/api/methods.ts` (reference JSON-RPC surface)
- `packages/connect/src/wallet.ts` (`OmniaClientPort`)
