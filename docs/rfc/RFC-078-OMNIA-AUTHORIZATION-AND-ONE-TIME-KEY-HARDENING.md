# RFC-078 — Omnia Authorization and One-Time-Key Hardening

Status: Draft — security and correctness remediation; no application-specific code
Created: 2026-11-08
Baseline: `main` at `7401b4be` (2026-11-08); pin the implementation commit at P0
Scope: `@totemsdk/omnia`, `omnia-host`, `omnia-router`, `omnia-relay`, `omnia-splice`, `omnia-factory`, `omnia-vtxo`, `statechain`, `wots-lease`; adjacent `chain-provider`, `storage`, `core` and KISSVM only where the fix requires it
Non-goals: implementing a particular router application, cash-in/cash-out integration, mobile-money APIs, or a broad replacement of the Omnia protocol

> **Naming rule:** this RFC is deliberately application-neutral. "Wakala" is a
> useful deployment example, not an SDK package, policy, module or default. SDK
> code must say "unattended forwarding application" or "multi-hop router" and
> must expose policy seams rather than hard-coding one deployment's rules.

---

## 1. Decision

Omnia's payment lifecycle needs a hardening pass before multi-channel,
unattended deployment. The reviewed implementation has five classes of defect:

1. **One-time-key allocation is scoped to labels, not cryptographic trees.** The
   default host can sign two channels with the same WOTS leaf.
2. **Valid state verification is treated as consent to co-sign.** The default
   inbound handler verifies the peer's state and then signs it without an
   independent economic-consent decision.
3. **The forwarding helper trusts its incoming HTLC.** It can lock outgoing
   liquidity without proving that the incoming lock exists, is accepted and has
   acceptable terms.
4. **Multi-hop initiation, forwarding and settlement are not one integrated
   path.** First-hop acceptance is reported as payment success.
5. **Protocol edge cases are not safe by construction.** Splice signing and
   sequencing are incompatible with the on-chain transaction; the statechain
   script accepts owner substitution after its timelock.

The fix is a set of **general SDK invariants and ports**, not a router feature
set. Applications supply policy values; the SDK supplies safe defaults and
fails closed when a required policy is absent.

## 2. Trust model and invariants

### 2.1 Principals

- **Local owner / host:** controls the WOTS seed, lease provider, channel store
  and release of funds.
- **Counterparty:** authenticated at the transport layer by `OmniaPeer.pubkey`,
  but transport identity is not automatically the channel party identity.
- **Forwarding peer:** a counterparty that sends a routing envelope and an
  incoming HTLC.
- **Chain:** authoritative for funding coins, confirmations, spends and
  timelocks; a chain provider is required for network acceptance.
- **Lease provider:** allocates WOTS indices. It is trusted only to the extent
  that its `treeId` is cryptographically bound to the signing key it represents.

### 2.2 Normative invariants

- A WOTS leaf MUST NOT be used for two signatures, across channels, purposes,
  processes or restarts.
- A peer signature MUST NOT be treated as the local owner's consent to reduce
  the local balance, remove a local HTLC or change the channel's economic terms.
- An outgoing HTLC MUST NOT be created until the incoming HTLC is authenticated
  and the link is durably recorded.
- A channel MUST NOT be reported as settled until the recipient has released
  the preimage and the backwards fulfilment is reconciled.
- A splice MUST sign the same canonical transaction bytes the chain will
  execute, and MUST observe the resulting coin before claiming success.
- A statechain spend MUST authenticate the **previous committed owner**, not an
  owner supplied by the spending transaction.
- A timelock or pre-signed close artifact is not a substitute for an automated
  monitor; unattended protection requires a running recovery service.

## 3. P0 findings and required fixes

### 3.1 WOTS leaf reuse across channels and purposes

**Defect.** `signTxDraft`/`prepareStateUpdate` reserve under
`omnia-channel-${channelId}` (`packages/omnia/src/sign.ts`), but the default host
signer uses one fixed child tree (`createUnifiedChildTreeKey(baseSeed,
localAddressIndex)`) and selects the leaf as `l1*64 + l2`
(`packages/omnia-host/src/signing.ts`). Per-tree lease cursors therefore start at
`(0,0,0)` for every channel. The same physical leaf is signed for different
channel updates. Manifest, factory-funding and sign-request paths use other
`treeId` labels but the same fixed key, so the blast radius is not limited to
channels.

**Required behavior.**

- A signing identity MUST expose a `treeId` derived from the actual tree root
  (or an equivalent collision-resistant key-tree identifier), not an arbitrary
  caller label.
- `WotsLeaseProvider.reserveKeyUse` MUST validate that `treeId` belongs to the
  signer/key material used to sign the reservation. A mismatch MUST fail closed.
- The host MUST choose one of:
  - **per-channel trees:** derive a distinct child tree per channel, bind its
    root into the channel funding script and commitment, and use that tree's
    identifier for leases; or
  - **global allocation:** keep one tree but allocate leaves globally across all
    channels and services, never per-channel cursors.
- Cross-process hosts MUST use an atomic claim/CAS lease store. The default
  `LocalLeaseProvider` without a CAS is in-process only and MUST refuse
  multi-process operation unless explicitly marked test-only.
- `signingIndices` MUST be cryptographically bound to the signature (or verified
  against the MMR proof) so a peer cannot claim a fresh index while reusing a
  leaf.
- Existing multi-channel deployments MUST rotate keys/channels if leaf reuse may
  already have occurred; changing bookkeeping labels is not a migration.

**Tests.** Two channels, two purposes, two host processes, restart between
reservations, concurrent reservations, lease-provider mismatch, repeated
manifest/factory signing, and an assertion that no leaf public key appears in
two signatures.

### 3.2 Inbound co-signing without economic consent

**Defect.** `bindPeerIntegration` verifies an inbound `STATE_UPDATE` with
`verifyStateForCoSign`, then calls `signState` (`packages/omnia/src/integration.ts`).
Verification covers sequence, conservation, commitment, program rules and
signatures; it does not decide whether the local owner consents to the proposed
balance or HTLC changes. A validly signed 1000/0 state from a peer can therefore
be co-signed by the party whose balance falls to zero.

**Required behavior.**

- Introduce a `CoSignPolicy` port inside the inbound path, evaluated **before**
  `signState`.
- The policy request MUST include: authenticated peer identity, channel id,
  current and proposed sequence, local balance before/after, full HTLC delta,
  program transition, the exact state commitment/digest, and the peer's
  signature/evidence.
- Default behavior MUST be deny when the local balance decreases, a local HTLC
  is removed/fulfilled without verified preimage evidence, or an unknown HTLC is
  added. A local manual-approval mode may explicitly allow selected changes.
- RPC-level authorization is insufficient: the peer co-sign path must enforce
  the same policy.
- The proposal MUST be validated structurally before policy: positive amounts,
  valid 32-byte hashlocks, bounded future timeouts, unique HTLC ids, correct
  counterparty, valid status transitions and preimage proof for fulfilment.
  Conservation alone is not enough; negative or duplicate HTLCs can otherwise
  pass the current sum check.

**Tests.** Balance-decreasing update, HTLC removal without preimage, negative
HTLC amount, duplicate HTLC id, invalid hashlock, timeout in the past, unknown
counterparty, policy deny/allow paths, and the existing manual-approval path.

### 3.3 Forwarder authenticates nothing before locking liquidity

**Defect.** `createMultiHopForwarder().forwardIncoming()` peels the envelope and
calls `addHTLC` on the outgoing channel without loading the incoming HTLC. It
does not verify that the incoming channel/HTLC exists, is accepted, is pending,
matches token/amount/hashlock, or leaves a safe timeout margin. `links` is an
in-memory `Map`; restart loses the link while the outgoing HTLC remains pending.

**Required behavior.**

- Require an `IncomingHtlcVerifier` that resolves the authenticated incoming
  channel and HTLC from durable state.
- Enforce: incoming status pending/accepted, hashlock match, token match,
  incoming amount >= outgoing amount + fee, outgoing timeout strictly earlier
  than incoming timeout, counterparty identity, and no duplicate hashlock.
- Reserve outgoing liquidity and journal the `HtlcLink` durably **before**
  sending the outgoing `STATE_UPDATE`.
- Make `forwardIncoming` idempotent by `(incoming channel, incoming htlc)` and
  define replay, partial completion, restart and failure outcomes.
- If the verifier/journal is not supplied, do not export the helper as a safe
  router primitive; fail closed.

**Tests.** Nonexistent incoming HTLC, wrong hashlock/token/amount, expired or
too-short incoming timeout, duplicate forward, crash after lock before journal,
crash after journal before send, restart, and backward preimage propagation.

### 3.4 First-hop acceptance is not recipient settlement

**Defect.** `payMultiHop` creates the first-hop HTLC and sends
`result.partialState` without a `payload.forward` envelope; it returns
`success: true` for a two-edge route. The default host does not implement the
independent next-hop forwarding protocol in that handler. The result therefore
means “first hop accepted,” not “recipient settled.”

**Required behavior.**

- Define a payment state machine:
  `initiated → first-hop-accepted → forwarded → recipient-settled → reconciled`,
  with terminal `failed`, `recovering` and `cancelled` states.
- Integrate payer initiation, authenticated per-hop acceptance, forwarding
  envelope propagation, recipient acknowledgement/preimage release, backward
  fulfilment, failure handling and durable reconciliation into one host path.
- Do not return `success: true` for a non-terminal state. Keep first-hop
  identifiers and the route in the result, but name the state accurately.
- The generic executor may remain injectable, but the default host must either
  wire it or explicitly report multi-hop as unsupported.

**Tests.** Two-edge route, missing forward envelope, relay acceptance but no
recipient preimage, recipient preimage and backward fulfilment, relay crash
before/after forward, duplicate request, and restart recovery.

### 3.5 Splice signing and sequencing are not chain-compatible

**Defect.** `computeSpliceTxDigest` hashes a JSON representation
(`packages/omnia-splice/src/splice-tx.ts`), while the submitted transaction is
Minima binary bytes. A WOTS signature over the package digest does not verify
over the binary transaction. The finalizer writes `currentSequence: 0` at the
unchanged channel address, although the channel script requires
`SEQUENCE GT PREVSEQUENCE` for non-settlement updates. It also labels the new
coin `${txpowId}-0` without observing the successor, and can mark the channel
active before confirmation.

**Required behavior.**

- Sign the canonical binary transaction digest used by the chain, or change the
  transaction builder so the signed and submitted bytes are identical.
- Use a script-compatible splice design: either a new script/key-rotation
  commitment or a sequence that satisfies the existing channel script. Resetting
  a sequence is not a WOTS-capacity reset.
- Observe/derive the real successor coin id and required confirmation before
  marking the channel active; recover safely from an interrupted broadcast.
- Add a chain-inclusive splice test; local signing round-trips are insufficient.

**Tests.** Binary digest verification, sequence transition from the prior state,
successor coin discovery, unconfirmed/spent/reorg cases, interrupted broadcast,
and old-channel invalidation.

## 4. P1 findings and required fixes

### 4.1 Fee and quote policy is not operational

Default host and relay edges use `feeRate: 0n`
(`omnia-host/src/router/routing-provider.ts`, `omnia-relay/src/routing.ts`).
Fee arithmetic works, but installing the host does not create a fee-earning
router. Advisory routing announcements are imported into an in-memory graph with
limited gossip and no authenticated expiry/capacity guarantee.

**Required work.** Add signed fee schedules, quote expiry, capacity reservations,
accepted-route policy, failed-forward accounting and actual earned-fee
settlement. Keep inventory and cash balances private; advertise bounded payout
capacity or per-quote commitments, not full channel state.

### 4.2 Statechain owner substitution after the timelock

`packages/statechain/src/script.ts` reads the owner from `STATE(0)`, the spending
transaction's supplied state, rather than `PREVSTATE(0)`. An outsider can sign
after the timelock, set `STATE(0)` to their own key, and satisfy
`SIGNEDBY(STATE(0))`. The factory and VTXO scripts already use `PREVSTATE` for
committed owners; statechain is the outlier.

**Required work.** Bind the normal and reclaim paths to the previous committed
owner, rebuild transfer/reclaim transactions and witness design, and add live-node
negative tests for outsider substitution. Until then, do not describe the
statechain transfer as a verified general-purpose bearer-value mechanism.

### 4.3 Channel proposal identity is not bound

`acceptChannel` trusts `proposal.localParty` and `proposal.remoteParty`;
`_handleChannelProposal` does not compare them with `config.signer` or the
authenticated `peer.pubkey`. A peer can propose a channel whose party set does
not match the connection or the host's signing identity. If no chain provider is
configured, funding coin/amount/token/confirmation checks are also skipped.

**Required work.** Require the local party to match the host signer, the remote
party to match the authenticated peer identity, and a chain provider for network
acceptance. Keep an explicit `allowUnverified` test/dev flag, but never use it in
the default integration.

### 4.4 Signature indices are not bound to signatures

`verifyStateSignature` and `verifyClosePackage` verify a `TreeSignature` against
the tree root, but do not prove that the claimed `signingIndices` equal the leaf
actually used. The index monotonicity check is therefore based on a
caller-supplied claim. A peer can reuse a leaf while claiming a fresh index,
hiding non-monotonicity and lease exhaustion.

**Required work.** Bind `(addressIndex, l1, l2)` into the signed state commitment,
or verify the signature's MMR proof/path against the claimed indices. Reject
mismatches. This also gives auditors a trustworthy answer to “which leaf signed
this state?”

### 4.5 Relay wallet signer ignores address index

`createWalletChannelSigningMaterial` accepts a `TreeKey` and an optional
`addressIndex`, but its `sign` only computes `l1*64 + l2` and never checks
`indices.addressIndex` against the tree/address it was given. A mismatched lease
can produce an invalid or cross-tree signature, and the failure is deferred to
on-chain verification. Check the address index and tree root at the signer
boundary and fail closed.

### 4.6 Cross-process lease allocation

`createHostSigning` constructs `LocalLeaseProvider(storage, undefined, deviceId)`
without a CAS. `withMutationLock` serializes only within one process. Two host
processes sharing the same lease directory can read the same watermark and
allocate the same index; atomic file writes do not make allocate-and-claim
atomic. Require a transactional/CAS lease store for multi-process operation,
and add a two-process concurrency test.

### 4.7 Additional findings from the second pass

These were not in the original external review and are added here as separate
SDK correctness issues:

- **Co-sign HTLC validation is structural-blind.** `validateStateForCoSign` sums
  pending HTLC amounts but does not reject negative amounts, duplicate HTLC ids,
  invalid hashlocks, past timeouts, wrong counterparties or invalid status
  transitions. A peer can move value with a malformed HTLC that still satisfies
  conservation. This is part of 3.2 and must be tested explicitly.
- **Proposal identity is not bound.** `acceptChannel` and
  `_handleChannelProposal` do not compare `proposal.localParty` with the host
  signer or `proposal.remoteParty` with `peer.pubkey`; see 4.3.
- **Signature indices are not bound.** `TreeSignature` verification does not
  prove that `signingIndices` is the leaf actually used; see 4.4.
- **Relay wallet signer skips the address check.** `createWalletChannelSigningMaterial`
  never compares `indices.addressIndex` with its tree/address; see 4.5.
- **Cross-process lease allocation is not CAS-protected.** The default host
  lease provider is in-process-safe only; see 4.6.

### 4.8 Unattended recovery is not automatic

The host has persistent maps and pre-signed close artifacts, but does not wire a
chain-watching contest-response and HTLC-resolution service. The standalone
forwarder links are volatile. A timelock is not a monitor. Provide a generic
`ChannelWatchService` (chain tip, close detection, contest response, HTLC
resolution, durable state, bounded retry) before claiming unattended protection.

## 5. Package ownership

| Area | Primary package(s) | Change |
|---|---|---|
| WOTS tree binding/allocation | `wots-lease`, `omnia`, `omnia-host` | tree-root-bound IDs, CAS allocator, signer/index checks |
| Co-sign policy | `omnia`, `omnia-host` | `CoSignPolicy`, structural HTLC validation, default deny |
| Forwarder | `omnia-relay` | incoming verifier, durable link journal, fee/timeout checks |
| Multi-hop lifecycle | `omnia-relay`, `omnia-host`, `omnia-router` | explicit payment states and integrated host path |
| Fees/quotes | `omnia-router`, `omnia-relay`, `omnia-host` | signed quotes, expiry, capacity, settlement |
| Splice | `omnia-splice` | binary digest, sequence/key-rotation, successor confirmation |
| Statechain | `statechain` | `PREVSTATE` owner binding, live negative tests |
| Watch/recovery | `omnia-host`, `omnia-vtxo` | generic watch service |
| Wallet signing | `omnia-relay`, `core` | address-index binding, tree-root checks |

## 6. Regression and acceptance matrix

| Test | Exit criterion |
|---|---|
| Multi-channel WOTS | No leaf public key appears in two signatures across channels/purposes |
| Multi-process lease | Two processes cannot reserve the same index; CAS-conflict fails closed |
| Signature index | Claimed indices match the signature proof; mismatch rejects |
| Inbound co-sign | Default denies balance decrease/HTLC removal; explicit policy allows |
| HTLC structure | Negative/duplicate/bad-hashlock/expired HTLCs reject before signing |
| Proposal binding | Wrong local/remote party or unverified funding rejects |
| Forwarder | Missing/unaccepted incoming HTLC rejects; link survives restart |
| Multi-hop | `success` only after recipient preimage; intermediate states explicit |
| Splice | Binary digest and sequence transition pass on a real node; successor observed |
| Statechain | Outsider owner substitution rejects on a live node |
| Watchtower | Contest response and HTLC resolution demonstrated in the challenge window |

## 7. Release and operational guidance

- Treat the P0 findings as a security release, not a feature release.
- If affected versions are on `latest`, publish a security advisory and a patch
  release; otherwise keep the fixes on `next` until evidence is complete.
- Until the WOTS fix lands, run **one channel per host signing key**. Do not
  deploy a multi-channel router on the affected versions.
- Until the co-sign policy lands, do not attach a raw unattended signer to
  `bindPeerIntegration`.
- Do not expose `createMultiHopForwarder` as a safe router primitive before the
  incoming verifier and durable link journal exist.
- Do not use splice for production liquidity or statechain transfers for
  bearer-value custody until the chain-inclusive tests pass.

## 8. Open questions

1. Per-channel tree derivation vs a global leaf allocator: which preserves the
   existing channel script and migration path with the least key churn?
2. Should `CoSignPolicy` live in `omnia` as a structural port, or in
   `omnia-host` as an application-facing policy layer?
3. What is the minimum durable router ledger contract that can be shared by the
   relay, host and future applications?
4. Which package owns the watch service, and how does it reference chain proofs
   without introducing a new graph/store?
5. How do existing multi-channel deployments detect and migrate possible leaf
   reuse?

## 9. References

Repository paths at the reviewed baseline:

- `packages/omnia/src/sign.ts` — channel tree reservations and co-sign validation
- `packages/omnia-host/src/signing.ts` — fixed child tree and leaf selection
- `packages/omnia/src/integration.ts` — inbound state/co-sign handler
- `packages/omnia-relay/src/forwarder.ts` — forwarding helper and in-memory links
- `packages/omnia-relay/src/client.ts` — first-hop `payMultiHop`
- `packages/omnia-host/src/router/routing-provider.ts`, `packages/omnia-relay/src/routing.ts` — zero-fee defaults
- `packages/omnia-splice/src/splice-tx.ts`, `finalize.ts` — JSON digest, sequence zero, coin id
- `packages/statechain/src/script.ts` — `STATE(0)` owner path
- `packages/omnia-factory/src/script.ts`, `packages/omnia-vtxo/src/owner-pool.ts` — existing `PREVSTATE` patterns to follow
- `packages/omnia/src/channel.ts` — proposal acceptance and funding checks
- `packages/omnia/src/transactions.ts` — canonical transaction digest and state commitment
- `packages/wots-lease/src/local.ts` — per-tree watermark/allocation
