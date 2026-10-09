# RFC-035 — Omnia Peer Coordination Protocol (Phase B: Factory, Virtual Channel & Splice Round-Trips)

**Status:** Draft — design specification
**Created:** 2026-10-08
**Authors:** Totem SDK Contributors
**Depends on:** RFC-014 (wallet connect parity), RFC-014 Amendment A (manifest truthfulness), RFC-034 (Omnia relay method parity, Phase A), RFC-002 (Omnia channel state machine), RFC-013 (wallet self-hosted mode)
**Touches:** `@totemsdk/omnia` (new `coordination` module + `messaging-types`), `@totemsdk/omnia-factory`, `@totemsdk/omnia-splice`, `@totemsdk/connect` (`wallet`), wallet bootstraps

> RFC-034 (Phase A) wires the Omnia operations a single wallet can drive alone
> (read-only queries and single-party constructors). This RFC specifies **Phase
> B**: the peer-to-peer coordination protocol for the operations that are
> **structurally multi-party** — factory opening/closing (N-of-N), virtual-channel
> opening (N-of-N), multi-hop payment (per-hop counterparty), and splice
> acceptance/finalization (two-party) — so a browser wallet can complete them with
> a remote peer over the Axia relay, without a central host.

---

## 1. Summary

The Omnia connect family is **13 methods**. **8** are unserved today by the relay
client. Phase A (RFC-034) serves **5** of them (all single-wallet: `getRoute`,
`getSwapRate`, `createFactory`, `spliceIn`, `spliceOut`). Phase B serves the
remaining **3**, which are structurally multi-party, and completes the
accept/finalize halves that make Phase A's factory/splice methods usable
end-to-end:

| Phase B work | Why multi-party | Source |
|---|---|---|
| `totem_omniaOpenVirtualChannel` | `collectNofN` needs **all N** `WotsLeaseBundle`s | `omnia-factory` `openVirtualChannel` |
| `totem_omniaCloseFactory` | settlement needs **all N** bundles | `omnia-factory` `closeFactory` |
| `totem_omniaPayMultiHop` | a `LeaseProvider` **per hop** | `omnia-router` `executeMultiHopPayment` |
| **factory accept** (completes Phase A `createFactory`) | co-signer signature | `omnia-factory` `acceptFactory` |
| **splice accept + finalize** (completes Phase A `spliceIn/Out`) | acceptor's signature + on-chain finalize | `omnia-splice` `acceptSplice`/`finalizeSplice` |

The last two rows are not separate connect methods: `createFactory` and
`spliceIn/Out` are Phase A *initiators* whose results only become usable once
Phase B gathers the counterparties' signatures. So Phase B closes 3 connect
methods and makes 3 more Phase A methods complete.

The SDK already has the **single-sided** halves and verified them in tests:

- `createFactory` (initiator) / `acceptFactory` (co-signer) — N-of-N opening.
- `openVirtualChannel` / (close) — N-of-N virtual-channel lifecycle.
- `closeFactory` — N-of-N cooperative settlement.
- `proposeSpliceIn/Out` (initiator) / `acceptSplice` (co-signer) / `finalizeSplice`
  (both) — two-party splice.
- `executeMultiHopPayment` — per-hop HTLC lock/reveal.

What is missing is the **transport and state machine that carries these between
peers**. Today `@totemsdk/omnia-host` does it by being a central server holding
every party's `factoryBundles`/`spliceProposals` in one memory map and calling the
single-sided functions synchronously. A browser wallet has no such host and only
the relay wire protocol, which knows exactly five message kinds:

```
CHANNEL_PROPOSAL | STATE_UPDATE | SETTLEMENT_PROPOSAL | ACK | ERROR
```

This RFC adds the coordination message kinds and a durable, verified round-trip
layer — a genuine mini-protocol, because it moves **authorization-relevant
material between mutually distrusting peers**.

## 2. Motivation

- **3 of the 13** Omnia connect methods (`openVirtualChannel`, `closeFactory`,
  `payMultiHop`) cannot be served by any single-wallet code path — their signature
  sets are N-of-N or per-hop — and a further **2 Phase A methods**
  (`createFactory`, `spliceIn/Out`) stay half-complete without the accept/finalize
  round-trips specified here.
- A thin wallet must be able to: propose a factory, collect N-of-N co-signatures
  from peers who may be offline, then commit; open a virtual channel with the
  counterparty; run a multi-hop payment; and propose a splice, obtain the peer's
  acceptance, and finalize. None of that exists over the relay.
- The relay never inspects message bodies (`framing.ts` is opaque length-prefixed
  JSON), so extending the protocol is a **client-side** change — but it is a wire
  format, so it must be specified, versioned, and adversarially reviewed.

## 2.1 Relationship to Phase A

RFC-034 makes these methods return a **reasoned `UNSUPPORTED`** (so no method is
silently absent). This RFC replaces those refusals with real round-trips. Two
Phase A pieces become inputs here:

- The `RoutingPort` (RFC-034 §6.1) supplies the graph `payMultiHop` routes over.
- The `createFactory` initiator (RFC-034 §6.4) produces the `opening` factory whose
  `FACTORY_PROPOSAL` this RFC broadcasts and whose `FACTORY_ACCEPT`s this RFC
  collects.
- The splice proposers (RFC-034 §6.5) produce the `SpliceProposal` this RFC
  transports and finalizes.

So Phase B does not duplicate Phase A; it completes it.

## 3. Current state (verified)

- `OmniaMessageType` has 5 members (`packages/omnia/src/messaging-types.ts:14`).
- `bindPeerIntegration` (`packages/omnia/src/integration.ts:116`) handles only
  `CHANNEL_PROPOSAL`/`STATE_UPDATE`/`SETTLEMENT_PROPOSAL`; `default: break`.
- `finalizeSplice` already returns/consumes `proposerReservationId` /
  `acceptorReservationId` and commits or burns WOTS leases
  (`packages/omnia-splice/src/finalize.ts`).
- `acceptFactory` / `acceptSplice` / `closeFactory` / `openVirtualChannel` are
  pure functions over already-known state; they do not themselves send messages.
- The Node host keeps coordination state in-memory only
  (`packages/omnia-host/src/api/methods.ts`: `factoryBundles`, `spliceProposals`,
  `spliceAcceptances` maps) — not durable, and not available to a wallet.

## 4. Goals

1. Carry factory/virtual-channel/splice proposals and acceptances between two or
   more peers over the existing relay, with explicit message kinds.
2. Make each round-trip a **verified** state machine: a peer signs only after
   validating the proposal against its own channel/factory state and the
   proposer's identity.
3. Survive reconnects and offline peers: proposals/acceptances are durable and
   idempotent, keyed by a stable id, with an explicit expiry.
4. Reuse the existing single-sided functions verbatim; the protocol is the
   transport + orchestration, not new cryptography.
5. Keep WOTS safety: reserved indices are committed on success and burned on
   rejection/expiry; never reused.
6. Degrade truthfully: until a peer accepts, the method's manifest disposition is
   `supported` only for the initiator half, with a reason (RFC-014 Amendment A).

## 5. Non-goals

- Making the wallet an autonomous executor; consent/approval still applies
  (RFC-014 §6.4).
- Federation/consensus among mutually-unknown parties; this is coordination among
  a channel's/factory's known counterparties.
- Replacing `SETTLEMENT_PROPOSAL` (channel close) — that already exists and is
  reused where applicable.
- A routing/gossip protocol (RFC-034 §6.1).

## 6. Design

### 6.1 New message kinds

Extend `OmniaMessageType` (additive; old clients ignore unknown kinds via the
`default` arm):

```ts
export type OmniaMessageType =
  | 'CHANNEL_PROPOSAL' | 'STATE_UPDATE' | 'SETTLEMENT_PROPOSAL' | 'ACK' | 'ERROR'
  // Phase B — coordination
  | 'FACTORY_PROPOSAL'      // initiator → all co-signers: opening commitment
  | 'FACTORY_ACCEPT'        // co-signer → initiator: signed opening
  | 'FACTORY_CLOSE_PROPOSAL'// initiator → all: settlement TX + allocations
  | 'FACTORY_CLOSE_ACCEPT'  // co-signer → initiator: signed settlement
  | 'VC_PROPOSAL'           // party → counterparty: virtual-channel open
  | 'VC_ACCEPT'             // counterparty → party: signed VC open
  | 'SPLICE_PROPOSAL'       // proposer → acceptor: splice TX + proposer sig
  | 'SPLICE_ACCEPT';        // acceptor → proposer: acceptor sig
```

Every coordination message carries a `correlationId` (the `factoryId` /
`virtualChannelId` / `spliceId`), a monotonically increasing `nonce`, the
`payload`, and a protocol `version`. `ACK`/`ERROR` remain generic.

### 6.2 A coordination module, not more `integration.ts` cases

Channel lifecycle and multi-party coordination have different state, durability,
and trust needs. Add a sibling module rather than growing `integration.ts`:

```
packages/omnia/src/coordination/
  index.ts          # createOmniaCoordination(...)
  factory.ts        # opening / closing state machines
  virtual.ts        # virtual-channel open
  splice.ts         # splice propose/accept/finalize
  proposals.ts      # durable proposal/acceptance stores
  verify.ts         # identity + state-binding verification
  errors.ts
```

It is wired the same way as the base integration — `bindPeerIntegration` gains a
`coordination` option, or the relay client composes both:

```ts
const coordination = createOmniaCoordination({
  swarm, channels, factories, leaseProvider, signer, chainProvider,
  store: durableProposalStore,          // RFC-007 storage adapter
  identity: localParticipant,
  policy: { autoAccept: false },        // consent: require approval for each accept
});
```

### 6.3 Round-trip state machines

**Factory opening (N-of-N):**

```
initiator (RFC-034 createFactory)         co-signer (×N-1)
  funding TxPoW already broadcast
  factory.status = 'opening'
  ── FACTORY_PROPOSAL ──────────────────►  verify (§6.5)
  collect FACTORY_ACCEPT ◄────────────────  acceptFactory(openingFactory, ownBundle) → own sig
  when all N signatures present: commit opening (→ 'active')
```

- Phase A's `createFactory` (RFC-034 §6.4) already mined and broadcast the funding
  TxPoW and left the factory `status:'opening'` holding the proposer's signature.
  Phase B does **not** re-broadcast funding.
- The `FACTORY_PROPOSAL` payload is the `opening` `ChannelFactory` (with
  `pendingCommitment`, `participants`, funding plan) minus any other party's
  signature.
- A co-signer runs `acceptFactory(openingFactory, ownBundle)` only after §6.5
  verification, and returns its signature. The initiator aggregates the
  signatures; when all N are present the opening is committed (`→ 'active'`).
- **Implementation note.** `commitOpening` is currently module-private
  (`packages/omnia-factory/src/factory.ts`). Phase B must either export it or
  drive the final signature through `acceptFactory` so the transition happens
  in-package. This is an implementation decision, flagged rather than assumed.
- Missing acceptances leave the factory `opening` (never `active`) and expire per
  §6.4.

**Factory closing (N-of-N):** same shape with `FACTORY_CLOSE_PROPOSAL` /
`FACTORY_CLOSE_ACCEPT` around `closeFactory(factory, leaseProviders, chainProvider)`
— which needs **all N** bundles and itself mines/broadcasts the settlement TxPoW
on the initiating side once signatures are gathered.

**Virtual channel (two-party, N-of-N within the factory):** `VC_PROPOSAL` carries
the factory sequence and the proposed `(parties, amounts)`; the counterparty runs
`openVirtualChannel(factory, parties, amounts, allNBundles)` — which requires all
N factory bundles via `collectNofN` — after verification and returns `VC_ACCEPT`.

**Multi-hop payment (per-hop counterparty):** `payMultiHop` routes over the
RFC-034 `RoutingPort` graph and locks an HTLC on each hop; each hop's counterparty
co-signs the `STATE_UPDATE` (existing message). This is the one Phase B item that
reuses the **existing** `STATE_UPDATE` rather than a new message kind; what it adds
is the orchestration (`executeMultiHopPayment`) plus a `LeaseProvider` per hop.

**Splice (two-party):**

```
proposer                                  acceptor
  quiesceChannel(...)                      (Phase A did propose)
  proposeSpliceIn/Out(...)  ── SPLICE_PROPOSAL ──►  verify + acceptSplice(...)
  collect acceptance ◄──────────────────────────── SPLICE_ACCEPT
  finalizeSplice(channel, proposal, acceptance)  ── mine/broadcast, commit/burn leases
```

`finalizeSplice` already handles the on-chain commit and lease commit/burn; the
protocol only carries the proposal and acceptance.

### 6.4 Durability, idempotency, expiry

Coordination state is durable (RFC-007 `StorageAdapter`), not the host's memory map:

- **Proposal store:** `correlationId → { kind, payload, state, createdAt, expiresAt, peers }`.
- **Acceptance store:** `correlationId → { partyId → signedAcceptance }`.
- Idempotent handlers: a re-delivered `FACTORY_ACCEPT` for an already-recorded
  party is ignored (matches `acceptFactory`'s “already co-signed” guard).
- **Expiry:** proposals carry a TTL (e.g. 24h). On expiry, uncommitted
  reservations are **burned** and the correlation is marked `abandoned`; a late
  acceptance is rejected. This bounds stranded WOTS indices and half-open
  factories.
- **Recovery:** on wallet restart, `opening` factories and pending splices are
  reloaded from the durable store; the initiator may re-solicit missing
  acceptances.

### 6.5 Verification (the security core)

Before signing anything, the accepting peer must:

1. **Bind to local state.** `proposal.channelId` / `factoryId` / `virtualChannelId`
   must match a locally-known object, and any referenced channel **sequence** /
   factory **sequence** must equal the local current sequence. Reject stale or
   ahead proposals (`SpliceChannelStatusError`, factory `status` checks already
   enforce much of this).
2. **Bind to the counterparty identity.** The proposer's `publicKeyDigest` must be
   a member of the channel/factory and must equal the WOTS key that signed the
   proposal. Re-verify `proposerSignature` with `verifySpliceSignatures` /
   `leaseSign` verification; **never** trust the transport `from` field
   (RFC-014 §9: no trust in relay identity).
3. **Conserve value.** `enforceConservation(factory)` for factories; splice
   `validateProposalParams` / `bindDraftToParams` / balance conservation for
   splices. A proposal that changes totals inconsistently is rejected before any
   signature is produced.
4. **Respect consent.** Every accept that produces a signature is an
   `requiresApproval` action; the wallet's approval port resolves first
   (RFC-014 §6.3/§6.4).
5. **One leaf, one message.** The acceptance signature leases a fresh index via
   the injected `WotsLeaseProvider` (RFC-013). Rejected accepts burn the
   reservation; finalized splices commit it.

### 6.6 Relay identity vs protocol identity

The relay authenticates the *topic* (`pubkey`), and frames carry `from`. This is a
**routing** identity only. All authorization derives from WOTS signatures over
canonical digests that are already computed by the factory/splice packages. A peer
that spoofs `from` gains nothing: the acceptance/proposal signature must verify
under the purported party's digest and that party must be a member of the object.

### 6.7 Wire compatibility & versioning

- Additive message kinds; unknown kinds are dropped by the existing `default` arm.
- Coordination messages carry `version: 1`. A future incompatible change bumps it;
  a receiver rejects a higher major version rather than mis-parsing.
- The relay/Axia contract is untouched (RFC-035 is entirely client-side framing).

## 7. Security & privacy

| Threat | Control |
|---|---|
| Spoofed proposal (wrong party) | Member + WOTS-signature verification (§6.5.2) |
| Replayed proposal/acceptance | Unique `correlationId` + `nonce`; idempotent stores; TTL expiry (§6.4) |
| State desync (stale sequence) | Sequence binding (§6.5.1); existing status/sequence guards |
| Value theft (tampered amounts) | Conservation checks (§6.5.3); each party signs the canonical digest, verified before finalize |
| WOTS index exhaustion / reuse | Lease per signature; burn on reject/expiry; commit on finalize |
| DoS via proposal spam | Bounded, expiring proposal store; per-peer rate limit; only known members accepted |
| Offline/malicious minority in N-of-N | Factory stays `opening`; expiry abandons it and burns leases; no partial commitment |
| Silent capability over-report | RFC-014 Amendment A: Phase B methods (and the accept/finalize halves) stay reasoned `unsupported` until implemented |

## 8. Phasing

- **B0** — message kinds + `coordination/` module skeleton + durable proposal
  stores + verification helpers (`verify.ts`); no behaviour change while
  `autoAccept` is off.
- **B1** — splice round-trip (`SPLICE_PROPOSAL`/`SPLICE_ACCEPT` +
  `finalizeSplice`), two-party, with approval.
- **B2** — factory opening round-trip (`FACTORY_PROPOSAL`/`FACTORY_ACCEPT`, the
  Phase A `opening` factory → `active`), N-of-N, with expiry/burn.
- **B3** — factory closing (`FACTORY_CLOSE_*`) and virtual-channel open (`VC_*`),
  N-of-N.
- **B4** — multi-hop payment (`payMultiHop` over the RFC-034 `RoutingPort` +
  per-hop `STATE_UPDATE`), with `executeMultiHopPayment`'s existing cancellation
  path on partial failure.
- **B5** — reconnect/recovery tests; wallet wiring; manifest flips all 8 Phase B
  methods to `supported` (RFC-014 Amendment A).

## 9. Acceptance / verification

- Two-peer and N-peer in-process relay tests: a factory opens only when all N
  accept; a splice finalizes only with a valid acceptance; a tampered
  amount/signature/sequence is rejected pre-signature.
- Replay test: re-sent `FACTORY_ACCEPT`/`SPLICE_ACCEPT` is idempotent.
- Expiry test: an unaccepted proposal expires, burns its reservation, and rejects
  a late acceptance.
- Recovery test: initiator restart resumes an `opening` factory from the durable
  store.
- Multi-hop test: a route crossing two hops locks and settles HTLCs in order, and
  a mid-route failure cancels the already-locked hops (no partially-settled route).
- No test produces a signature before approval; no signature bypasses the lease
  provider.
- RFC-014 Amendment A truthfulness test holds for the newly supported methods.

## 10. Risks

| Risk | Mitigation |
|---|---|
| Protocol bug enables theft/desync | Verify-before-sign (§6.5); conservation checks; versioned wire; adversarial review before B1 |
| Half-open factories strand funds | TTL + burn + explicit `abandoned` state; no partial `commitOpening` |
| Durable store grows unbounded | TTL eviction; bounded in-flight proposals per peer |
| Peer implementation divergence | Reuse the exact factory/splice functions and canonical digests; conformance vectors in `__tests__` |
| Approval fatigue | Batch a factory's acceptances into one approval where safe; document per-op consent |

## 11. Open questions

1. **Proposal fan-out.** One message per peer, or a topic broadcast to the
   factory's member set? (Affects relay topic design; ties to RFC-034 §12 Q1.)
2. **Partial acceptance policy.** May an N-of-N factory open with a configurable
   threshold, or must it stay strictly N-of-N as today? (The script is N-of-N.)
3. **Dispute path.** If a co-signer accepts but the initiator never commits, is
   there an on-chain abort, or only lease-burn + retry?
4. **Cross-wallet interop.** Must the PWA and extension speak identical
   coordination versions, or negotiate?

## 12. References

- RFC-014 §6.3–6.5; RFC-014 Amendment A (capability manifest truthfulness)
- RFC-034 (Omnia relay method parity — Phase A)
- RFC-002 (Omnia channel state machine), RFC-003 (built-in programs), RFC-013 (self-hosted lease)
- RFC-007 (storage durability)
- `packages/omnia/src/{messaging-types,integration,framing,relay}.ts`
- `packages/omnia-factory/src/{factory,virtual,settlement}.ts`
- `packages/omnia-splice/src/{splice,finalize,quiesce}.ts`
- `packages/omnia-host/src/api/methods.ts` (reference in-memory coordination)
