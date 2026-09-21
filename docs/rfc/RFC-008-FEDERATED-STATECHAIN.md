# RFC-008: Federated Statechain — Leased WOTS Identity & Threshold SE Federation

**Status:** Draft — Phase 1 landed (leased-WOTS identity + SE server wiring + client envelope verification + SE hardening AUD-026/027/029); remaining: on-chain witness wiring (RFC-009 Phase 3) + Go parity
**Created:** 2026-09-21
**Authors:** Totem SDK Contributors
**Reviewers:** [Pending stakeholder assignment]

---

## 1. Summary

The statechain ships today as the **Mercury model**: a UTXO is locked into a
statechain script, ownership moves off-chain without an L1 transaction via a
blind State Entity (SE) signature, the full custody chain is verifiable, and the
owner has a cooperative claim path plus a unilateral reclaim path after a
timelock. The SE is deliberately blind — it sees a transfer but not the UTXO
value or the sender/receiver identities. We have also built a self-hostable SE
server (creation, challenges, blind signing, key revocation/change, claims,
reclaim, operator registry, configurable fees, `onSign` billing hook), so
statechain operation is itself a DML infrastructure business.

Two things are true and must be separated:

1. **The single-SE implementation has a defect that must be fixed now.** The SE
   signs every blind-sign and claim with the **same one-time WOTS leaf**
   (index 0), and advertises a public key that is *not* the key it signs with
   (audit AUD-003, AUD-025; the Go SE is an HMAC placeholder, AUD-045). This is
   a one-time-signature violation and, once the advertised-key mismatch is
   fixed, a directly exploitable key-reuse path.
2. **The architecture we actually want is federated**: `owner + threshold
   federation of SEs` (e.g. 3-of-5), not `owner + individual SE`. That is a
   different trust model and a separate body of work.

This RFC does both, in the right order. It specifies a **single-SE redesign
using federation-shaped interfaces** (SE identity as a root commitment,
per-state leased leaves, verification as set-membership) so the single-SE
product is correct today and the move to `k-of-n` is **additive, not a
rewrite**. It then lays out the complete additional work — k-of-n script,
blind-sign coordination, federation registry/bonding/slashing, equivocation
proofs, privacy and liveness policy, and the SE-choice marketplace — required
to reach the mature federated DML privacy architecture.

**Pre-release posture (inherited from RFC-007):** nothing here preserves
wire-format backwards compatibility. We change the SE identity, the transfer
record, and the locking script freely, with explicit on-disk/wire versions and
no silent re-encoding of committed material.

## 2. Motivation

### 2.1 What the Mercury model already gives us

| Property | Mechanism |
|---|---|
| UTXO locked into a statechain | `buildStatechainScript(sePkd)` — `MULTISIG(2 STATE(0) SE)` cooperative branch, `SIGNEDBY(STATE(0))` reclaim branch after `RECLAIM_TIMELOCK` (`packages/statechain/src/script.ts`) |
| Ownership transferred without an L1 transaction | Off-chain transfer records; only claim/reclaim touch L1 |
| Blind SE signature | SE signs a blinded commitment; SE never sees value or parties (`router.ts` `/:chainId/blind-sign`) |
| Full custody chain verification | `verifyStateChain` walks transfer history (continuity, transfer-key lineage, digest provenance, SE + owner signatures) |
| Cooperative claim | Owner + SE co-sign the claim spend (`/:chainId/claim`) |
| Unilateral reclaim if the SE disappears | Owner-only `SIGNEDBY(STATE(0))` after `RECLAIM_TIMELOCK` |
| Self-hostable SE | `SeServerConfig` (`seSeed`, `databaseUrl`, `reclaimTimelock`, `betaMode`, `onSign`), Postgres durability, Axia SE Registry announce (`sePublicKey`, `url`, `name`, `feeBasisPoints`, `proofNonce`, `proofSignature`), 7-day registry TTL |
| DML business surface | Operator registry, per-project billing via `onSign`, self-announce |

### 2.2 The single-SE gap

The Mercury model provides trust **minimisation** (blind signing + reclaim), not
trust **distribution**. It is:

```
owner + individual SE
```

A single SE is a single point of:
- **co-signature availability** (liveness) — mitigated only by the owner reclaim;
- **custody-chain blindness** (privacy) — one entity can correlate blinded
  commitments over time;
- **misbehaviour** — there is no federation to out-vote or slash it.

The mature architecture is:

```
owner + threshold federation of SEs   (e.g. 3-of-5)
```

where a transfer requires the owner plus `k` independent SE co-signatures, each
SE is an independent, bonded operator, and any single SE's absence or
misbehaviour is absorbed by the threshold. This becomes a second bonded
infrastructure market on top of the registry we already have.

### 2.3 Why fix the single SE first, and federation-shape it

We cannot ship a correct federation on top of a broken single SE. The
AUD-003/025/045 defects must be fixed regardless of federation. Critically, the
*interface shapes* chosen for that fix determine whether federation is additive
or a rewrite. Therefore:

- **Do now:** correct single-SE WOTS handling using the SDK's existing
  `@totemsdk/root-identity`, `@totemsdk/identity`, `@totemsdk/wots-lease`,
  `@totemsdk/proof`, and `@totemsdk/core` primitives, expressed in terms that
  already read as "a list of authorized SE members."
- **Do later (scoped here):** k-of-n script, coordination, registry/bonding/
  slashing, equivocation proofs, privacy policy, and the SE-choice marketplace.

### 2.4 Non-goals

- **No on-chain tree/proof verification.** We do not attempt to verify an
  SE child-authorization proof inside KISSVM. The cooperative branch stays a
  plain key check; SE identity/authorization is verified **off-chain** at
  script construction and in the client.
- **No new signature scheme.** We use the existing WOTS/TreeKey primitives; the
  novelty is *allocation and identity framing*, not cryptography.
- **No consensus change.** This is an SE/protocol layer change.
- **No claim that federation improves privacy against a colluding majority.**
  Threshold is also a privacy threshold (§13).

## 3. Current State (verified)

### 3.1 `@totemsdk/se-server`

- Identity/signing: `packages/se-server/src/seKey.ts`
  - `getPublicKeyHex(seed) = sha3_256(seed || 0000)` — **not** the signer key.
  - `seSign(seed, commitment) = wotsSign(seed, 0, commitment)` — **always index 0**.
  - `getPublicKeyHexAsync` uses `wotsPublicKeyFromSeed(seed, 0)` (the real key) —
    disconnected from the advertised key.
- Routes (`router.ts`): `GET /se-public-key`, `POST /create`,
  `GET /:chainId/challenge`, `POST /:chainId/blind-sign`,
  `POST /:chainId/revoke-key`, `GET /:chainId`, `POST /:chainId/claim`,
  `GET /:chainId/reclaim-tx`.
- `/create` hardcodes the advertised `sePkd` into the locking script and stores
  it as `statechain_records.se_public_key`.
- Operator registry: Axia SE Registry announce with `sePublicKey`,
  `feeBasisPoints`, and a WOTS `proofSignature` over the announce message.
- Go SE (`packages/se-server/go/sekey.go`): `seSign` = HMAC-SHA256;
  `wotsVerifyDigest` compares `SHA3(sig||pk)` to `SHA3(msg)` — a placeholder,
  **not interoperable WOTS**.

### 3.2 `@totemsdk/statechain`

- `StateChain.sePublicKey: string` — a single 32-byte digest.
- `TransferRecord.blindedSignature: string` — a single SE signature per hop.
- `verifyStateChain` verifies the SE signature as
  `wotsVerifyDigest(sig, commitment, sePublicKey)` (`verify.ts:141`).
- Client-side durable chain store exists (RFC-007 Phase 4).

### 3.3 Locking script

```
LET OWNER=STATE(0)
IF @COINAGE GTE RECLAIM_TIMELOCK THEN
  RETURN SIGNEDBY(OWNER)
ENDIF
ASSERT MULTISIG(2 OWNER <SE>)
RETURN TRUE
```

`<SE>` is a single fixed key chosen at `/create`.

### 3.4 Defects (audit)

| # | Defect | Location |
|---|---|---|
| AUD-003 | SE signs every message with one-time key index 0 | `seKey.ts:36` |
| AUD-025 | Advertised SE public key ≠ the signing key; script key is unusable | `seKey.ts:19` |
| AUD-045 | Go SE is a placeholder, not interoperable WOTS | `go/sekey.go:24,34` |
| AUD-026/027/029 | Related SE hardening: request binding, stale-snapshot ownership race, claim-digest | `router.ts`, `httpClient.ts` |

Fix AUD-025 alone and AUD-003 becomes exploitable; they are one fix.

### 3.5 Building blocks already present (do not reinvent)

- **`@totemsdk/root-identity`** `UnifiedIdentityWallet`: a **root identity
  TreeKey** (anchor, never a spend address) plus up to 64 **child** TreeKeys,
  each with an independent use watermark. `signFromChild(i, message) -> WotsProof
  { address, publicKey, signature (TreeSignature hex), message }`;
  `proveOwnership([children]) -> OwnershipProof` (the root signs a canonical
  commitment to the chosen child public keys); `verifyOwnershipProof`;
  `getWatermarkState` / `restoreWatermarkState`, `getRootUses`/`setRootUses`,
  `getChildUses`/`setChildUses`.
- **`@totemsdk/identity`**: documents, delegation claims, revocation, rotation.
- **`@totemsdk/wots-lease`**: `LocalLeaseProvider` (durable watermark + append-only
  journal) with `reserveKeyUse` / `reserveSpecificKeyUse` / `commitKeyUse` /
  `burnReservation`, `advanceToRemoteWatermark`, and the AUD-004/AUD-005 reload-merge
  and cursor fixes. This is the **one-time-key allocation authority**.
- **`@totemsdk/proof`**: `signWithLease` (reserve → `signProof` → commit/burn),
  `signProof`, `verifyProofSignature`.
- **`@totemsdk/core`**: `TreeKey`, `verifyTreeSignature`, `derivePKdigest`,
  `wotsSign`, MMR (`createMMRDataLeafNode`, `verifyMMRProof`).

## 4. Design Invariants

1. **One leaf, one message, forever.** A WOTS leaf signs at most one message,
   durably, across restarts and concurrent requests. Allocation is owned by
   `@totemsdk/wots-lease`; nothing else picks indices.
2. **The SE identity is a root commitment, never a bare leaf.** The published SE
   identity authorizes a *set* of leaves; clients verify a leaf by verifying
   root authorization, not by trusting a leaf key.
3. **SE blindness is preserved.** No federation member sees UTXO value or
   sender/receiver identities; blinding is per member.
4. **Recovery never depends on the SE.** The owner unilateral reclaim remains
   the liveness backstop; federation must not weaken it.
5. **The cooperative branch is a plain key check on-chain.** Authorization is
   proven off-chain; the chain verifies only that the bound leaf signed.
6. **Federation-shaped now.** Every single-SE structure is expressed as
   "member `i` of a set of size `n`, threshold `k`" with `n=1, k=1` today.
7. **No silent reuse, no silent downgrade** (RFC-007 §4.2): a missing/expired
   leaf reservation fails closed; a reused leaf is detectable and provable.

## 5. Target Architecture

### 5.1 Overview

```
            off-chain (per transfer)                     on-chain (claim/reclaim)
   owner ──blind commitment──┐
                             ├─ SE_1 child leaf ─ WotsProof ─┐
                             ├─ SE_2 child leaf ─ WotsProof ─┤  custody chain
                             └─ SE_k child leaf ─ WotsProof ─┘
                                                              │
   locking script (per state): owner AND k-of-n SE leaves ────┘   cooperative claim
   reclaim script:             owner only after timelock          unilateral reclaim
```

- **Single SE today:** `n=1, k=1`; one member, one root identity, one leased
  child leaf per signature.
- **Federation:** `n` independent SE operators, `k` required; identical shapes,
  larger set.

### 5.2 SE identity = root identity + versioned `OwnershipProof`

Each SE is a `UnifiedIdentityWallet`:

- **Root identity** (anchor): `rootAddress` + `rootPublicKey`. Never a spend key.
- **Versioned `OwnershipProof`**: the root signs a canonical commitment to the
  child public keys the SE will sign from. Published via `GET /se-public-key`
  and embedded in client config; **versioned** so revocation/rotation is a new
  proof, not a mutation of an old one.
- The Axia registry announce carries this identity (root + proof version)
  instead of a bare `sePublicKey`; the announce `proofSignature` becomes a root
  `WotsProof` over the announce message.

**Root watermark.** The root itself signs `OwnershipProof`s and is one-time
too; root uses are leased/watermarked exactly like child uses, and proofs are
**long-lived, versioned leaf-set commitments** — not issued per transfer.

### 5.3 Per-state leased leaves + locking script v2

For a given statechain, each member dedicates a **leased leaf** whose public key
is bound in the script for that state. Transfers are off-chain and each
blind-signature consumes a further distinct leaf from the same member.

**Script template v2 (single SE today, `n=1`):**

```
LET OWNER=STATE(0)
IF @COINAGE GTE RECLAIM_TIMELOCK THEN
  RETURN SIGNEDBY(OWNER)                 # unilateral reclaim, unchanged
ENDIF
ASSERT SIGNEDBY(OWNER)
ASSERT MULTISIG(k <SE_1_leaf> ... <SE_n_leaf>)   # k-of-n member leaves
RETURN TRUE
```

- `n=1, k=1` reproduces today's semantics with a *correct, dedicated* SE leaf.
- `k-of-n` is the federation form; the template is versioned so v2 can land as
  `n=1` and widen without a format break beyond the version bump.
- The SE leaf keys are 32 bytes each; script size scales linearly and cheaply
  with `n`. The **signatures**, not the keys, drive witness cost (§14).

**Why bind leaves (not the root) on-chain.** Binding the root would force
on-chain verification of "this child is authorized by the root" (a
`TreeSignature`/`OwnershipProof` inside KISSVM). That is high witness/script
complexity and, because the cooperative branch is already owner + SE, buys
little: the owner consents regardless. Binding the *specific per-state leaf*
keeps the chain check a plain WOTS key check while the identity anchor is
enforced off-chain.

### 5.4 Durable leaf allocation (the AUD-003 fix, via `wots-lease`)

The SE/SE-members allocate leaves through `LocalLeaseProvider`
(durable watermark + journal), never a hand-rolled counter and never a fixed
index:

```
reserve(reservation)                      # watermark + journal, restart-safe
  → root/child signFromChild(leaf, msg)   # one leaf, one message
  → commitKeyUse(reservationId, ...)      # or burnReservation on failure
```

- The AUD-004/AUD-005 fixes (reload-merge before mutation; below-cursor slots
  unavailable) make allocation safe across provider instances and remote
  watermark sync — which is exactly what an operator running multiple processes
  or a federation needs.
- The journal is audit authority; the watermark is allocation authority
  (RFC-007 §4.2 accounting-authority principle).

### 5.5 Blind signing with leased leaves

`POST /:chainId/blind-sign` and `/:chainId/claim`:

1. Lease the next leaf for the SE/chain (`reserve`).
2. Produce the signature (`signFromChild` → `WotsProof`, or the chain's
   dedicated claim leaf).
3. `commit` on success, `burn` on failure/expiry.
4. Record `{ memberId, leafPublicKey, proofVersion }` with the transfer so the
   custody chain is verifiable.

The SE still signs only a blinded commitment; value and parties remain hidden.

### 5.6 Verification model

**Transfer record** carries, per SE member: `memberId`, `leafPublicKey`,
`proofVersion`, `signature`, and the blinded commitment. Verification:

1. **Member authorization (off-chain):** `leafPublicKey` is a member of the
   member's `OwnershipProof` for `proofVersion`
   (`verifyOwnershipProof`); reject otherwise.
2. **Signature:** the `WotsProof`/`TreeSignature` verifies over the commitment
   against `leafPublicKey`.
3. **Custody continuity:** unchanged from today (chain links, transfer-key
   lineage, digest provenance, owner signature).
4. **Custody chain:** the full history still verifies; a leaf authorized but
   used twice is **detected** (§5.7).

**Custody chain verifier (`verifyStateChain`)** stops checking one fixed
`sePublicKey` and instead iterates the member list, doing membership +
signature checks per member. For `n=1, k=1` this is a single-element loop.

### 5.7 Equivocation is self-incriminating (the federation payoff)

Because leaves are one-time and durably watermarked, an SE that signs two
conflicting transfers for the same state must reuse a leaf. Two WOTS signatures
over different messages with the same leaf reveal enough chain material to
forge for the unused part of that leaf — i.e. **a publicly verifiable
equivocation proof**. This is the slashing primitive the federation market
needs, and it comes for free from the leased-leaf design. A single-SE system
never surfaces it.

### 5.8 Why this shape federates

- SE identity is a **root + set**, so `n` members are `n` roots.
- Per-state leaf binding is **per member**, so the script grows from one leaf to
  `n` leaves and a threshold.
- Verification is already **"is this leaf authorized by a member root"** — it
  becomes "do `k` members each authorize."
- Allocation is already durable and per-member — it becomes per-member watermarks
  with cross-member equivocation detection.
- Nothing in the single-SE redesign assumes a single signer.

## 6. Phase 1 — Single-SE redesign with federation-shaped interfaces (now)

**Scope**

- Replace `seKey.ts` index-0 WOTS with a `UnifiedIdentityWallet`-backed SE
  identity (root + versioned `OwnershipProof`) and leased child leaves via
  `LocalLeaseProvider`.
- Publish the SE identity (root + proof version) from `GET /se-public-key` and
  registry announce; remove the fake `getPublicKeyHex`.
- Locking script v2: bind a **dedicated, leased** SE leaf per statechain
  (`SIGNEDBY(OWNER)` + `MULTISIG(1 <SE_leaf>)`), reclaim path unchanged.
- Transfer records carry `{ memberId, leafPublicKey, proofVersion, signature }`;
  `verifyStateChain` verifies member authorization + signature (single-element
  member list).
- Durable SE watermarks via `wots-lease`; persist/restore on restart
  (`getWatermarkState`/`restoreWatermarkState`).
- Go SE: **fail closed** (`seSign`/`wotsVerifyDigest` refuse; `/se-public-key`
  and signing routes return not-implemented) until it implements the scheme.
- Fold in AUD-026/027/029 as part of SE hardening (request binding, transactional
  ownership transition, canonical claim digest).

**Acceptance gates**

- No two messages are ever signed by the same leaf across restart, concurrent
  requests, or provider instances (fault-injected + concurrent tests).
- A real SE signature verifies against the **published** identity; the
  advertised key is the signer's (AUD-025 regression).
- Custody-chain verification accepts a valid chain and rejects: a leaf not
  authorized by its member root, a signature over the wrong commitment, and a
  reused leaf (equivocation detected).
- Reclaim-without-SE still works; claim requires owner + the bound SE leaf.
- Go SE returns not-implemented on every signing/identity route.

### 6.1 Phase 1 status (2026-09-21)

**Landed (Phase 1a — identity/signing core, and Phase 1b — SE server wiring).**

- `packages/se-server/src/seIdentity.ts` — `SeIdentity`: a `@totemsdk/root-identity`
  `UnifiedIdentityWallet` (root anchor + versioned `OwnershipProof`) whose
  one-time leaf allocation is owned by `@totemsdk/wots-lease`
  (`LocalLeaseProvider`: durable watermark + journal). `signChild`/`signRoot`
  lease the next child/root leaf, sign, and commit (or burn on failure);
  `verify` checks root proof, leaf-set membership, and the one-time signature.
  The leaf space (`flatLeafIndex`) maps the lease provider's
  `(addressIndex,l1,l2)` onto the child TreeKey's uses, and the published
  identity is a root + authorized-leaf set (federation-shaped: `n=k=1` today).
- `packages/se-server` routes wired: `createSeRouter` builds the identity once
  (`seStorage` config, operator-injected durable adapter); `GET /se-public-key`
  publishes the root identity + `OwnershipProof` + proof version (additive
  `seRootAddress`/`seOwnershipProof`/`seProofVersion`); `POST /create` binds the
  SE **root** in the locking script; `POST /blind-sign` signs a leased **child**
  leaf and returns the envelope (additive `seSignature`; `blindSignature`
  carries the one-time `TreeSignature` hex); `POST /claim` returns a leased
  **root**-leaf signature. The legacy `getPublicKeyHex`/`seSign` are no longer
  used by the server (deprecated).
- `packages/se-server/src/__tests__/seIdentity.test.ts` — regression coverage
  for AUD-003 (distinct leaf per message, no index-0 reuse), AUD-025 (published
  root authorizes the signer), and restart safety (durable lease watermark);
  `router.test.ts` updated for the root identity. se-server suite 33/33.
- `packages/se-server/go/sekey.go` — the Go SE signer/verifier now **fail
  closed** (`ErrNotInteroperable`): no placeholder HMAC "signatures", no
  non-WOTS acceptance (AUD-045). Go parity remains Open Question 7.
- `packages/statechain` client verification wired: `SEClient.blindSign` may
  return the RFC-008 envelope (union with the legacy hex string);
  `TransferRecord.seSignature` and `StateChain.seOwnershipProof`/`seProofVersion`
  carry it; `verifyStateChain` verifies a `child` envelope against the SE root's
  `OwnershipProof` (membership + one-time signature) and a `root` envelope
  against the published root, falling back to the legacy fixed-key check for
  string-only clients. `HttpSEClient` returns the envelope; `se-envelope.test.ts`
  covers the gate (statechain 115/115).
- `packages/se-server/src/seKey.ts` — the legacy `getPublicKeyHex` /
  `getPublicKeyHexAsync` / `seSign` (a fixed index-0 key whose advertised digest
  did not match the signer) are **removed**; only generic
  `wotsVerifyDigestAsync` verification and the reclaim-tx encryption helpers
  remain. `seKey.test.ts` updated accordingly.
- `SDK_MANIFEST.json` — `@totemsdk/se-server` deps synced
  (`root-identity`, `storage`, `wots-lease`); `pnpm install` linked them.

**Outstanding (Phase 1b — on-chain witness + Go parity).**

- On-chain witness format: the claim depends on a leased **root**-leaf
  `TreeSignature` verifying under `MULTISIG`/`SIGNEDBY` against the SE root.
  **RFC-009** landed the required Minima-faithful TreeKey `SignatureProof`
  verification in the KISSVM validator, and its §7 gate passes
  (`packages/statechain/src/__tests__/onchain-witness.test.ts`: the cooperative
  branch validates a real `TreeSignature` against the SE root). What remains is
  wiring the statechain client's claim witness to emit the tree signature
  (RFC-009 Phase 3).
- Rewrite `seKey.test.ts` for the deprecated legacy functions; Go signing routes
  return HTTP 501 explicitly.

**SE hardening landed (AUD-026/027/029).**

- **AUD-026** — owner authentication is bound to a domain-separated message over
  chain + operation + nonce + body
  (`packages/se-server/src/ownerAuth.ts`, mirrored in
  `packages/statechain/src/httpClient.ts`); a pending owner signature can no
  longer be replayed against a different endpoint or body.
- **AUD-027** — `revokeOwnerTransactional` consumes the nonce, inserts the
  revocation, and advances the owner in one transaction guarded by a row lock
  and a version CAS, rejecting stale-owner requests instead of overwriting a
  newer ownership state.
- **AUD-029** — `/claim` signs the canonical transaction digest
  (`computeTransactionDigest`) rather than the UTF-8 bytes of the hex text.
- Regression tests added in both packages (se-server 36/36, statechain 121/121).

Phase 1 is **landed** except for the on-chain witness wiring (RFC-009 Phase 3)
and Go parity (Open Question 7).

## 7. Phase 2 — Federation interfaces (membership, registry, bonding)

**Scope**

- Generalize config/records from one SE to a **member list** (`n >= 1`) with a
  threshold `k`; `n=k=1` remains the default.
- Extend the Axia registry entry: per-member identity (root + proof version),
  endpoint, `feeBasisPoints`, bond reference; a **federation descriptor**
  `{ members[], threshold }` that a wallet can pin per statechain.
- Client config: pin a federation descriptor and verify each member's
  `OwnershipProof` before use.
- Bonding interface (registration of a bond reference + slashing hook) —
  mechanism stubbed, market rules detailed in Phase 4.

**Acceptance gates**

- `n=1,k=1` behaviour unchanged (regression).
- A wallet can select, pin, and verify a federation descriptor; a member whose
  proof does not cover a leaf is rejected.

**Explicitly deferred to Phase 5:** SE *choice* / marketplace UX.

## 8. Phase 3 — k-of-n threshold script + blind-sign coordination

**Scope**

- Locking script v3: `ASSERT SIGNEDBY(OWNER)` composed with a `k-of-n`
  `MULTISIG` over the members' per-state leaves (exact KISSVM composition and
  parameter order to be confirmed against the evaluator during implementation).
- **Blind-sign coordination protocol**: a transfer owner/wallet requests a
  blinded commitment signature from each member, collects `k` (any subset of
  size `k`), and assembles the witness; partial failures are tolerated
  (`n-k` members may be offline). Define request/response messages, timeouts,
  and retry.
- Per-member persistence of the `k` signed members for the custody chain.
- Liveness policy: define "SE disappeared" under `k-of-n`, the reclaim
  timelock interaction, and the minimum `k` for transfer vs. claim.

**Acceptance gates**

- A transfer completes with exactly `k` of `n` members; witness verifies.
- A transfer fails closed when fewer than `k` members respond; reclaim remains
  available.
- A member cannot substitute another member's leaf (authorization check holds).

## 9. Phase 4 — Equivocation proofs + slashing market

**Scope**

- **Equivocation proof construction**: package the two conflicting records +
  shifted leaves into a public, verifiable proof; a verifier burns a leaf's
  shared chain to demonstrate double-signing.
- **Detection**: cross-member/observer publication of used-leaf commitments (a
  light append-only log or gossip) sufficient to catch a member signing
  conflicting transfers.
- **Slashing rules**: map a valid equivocation proof to a bond-slashing action;
  define the bonded registry, dispute window, and adjudication.
- **Fees**: per-member fee accounting and settlement for the federation
  (`onSign` becomes per-member).

**Acceptance gates**

- A forged equivocation proof is rejected; a genuine one verifies from public
  data alone.
- Slashing fires exactly once per proven equivocation; a bond cannot be
  double-slashed for the same proof.

## 10. Phase 5 — Privacy hardening (threshold = privacy threshold)

**Scope**

- Per-member blinding (distinct blinding factors) so no single member can
  correlate; document the collusion threshold explicitly.
- Metadata minimisation: what the witness reveals (which `k` members signed),
  what the chain reveals at claim, and what each member sees over time.
- Optional mix/rotation of member subsets per transfer to reduce linkability,
  with an explicit statement of the residual leakage.

**Acceptance gates**

- A single member (and any minority below the collusion threshold) cannot link
  blinded commitments to value or parties in the test model.
- Documentation states the collusion threshold and the on-chain metadata
  surface.

## 11. Phase 6 — SE choice / marketplace (the corridor demo path)

**Scope**

- Multiple independent SE operators (already possible); wallet SE **choice**
  from the registry (filter by fee, bond, reputation, jurisdiction).
- Federation selection: choose `n`/`k` and members per statechain; record the
  descriptor.
- For the corridor demo, this is **only** "run several independent SEs and
  choose one" — no threshold required; the federation phases must not block it.

**Acceptance gates**

- A wallet discovers, selects, and transacts against a chosen SE end-to-end.
- Two different wallets can pin different SEs/federations for different chains.

## 12. Security & Threat Model

| Threat | Mitigation |
|---|---|
| SE one-time-key reuse | Leased leaves (`wots-lease`), invariant §4.1; equivocation proof (§5.7) |
| Advertised key ≠ signer | Identity published as root + proof; signer is a covered leaf (Phase 1) |
| Malicious member substitutes a leaf | Off-chain `OwnershipProof` membership check (§5.6) |
| Single-member unavailability | `k-of-n` threshold; owner reclaim backstop (§4.4, Phase 3) |
| Member double-signs (equivocation) | Public equivocation proof + slashing (§9) |
| Stale-owner / request-replay on the SE | AUD-026/027/029 hardening (Phase 1) |
| Fake/non-interoperable SE | Go SE fails closed; registry identity must verify (§6) |
| Loss of SE seed | Root identity is a single seed; operator backup policy; note the trade-off vs. federation resilience |

**Non-mitigation stated honestly:** a compromised owner key is out of scope
(2-of-N still requires the owner); a colluding `k`-majority of members is the
trust threshold for both custody and privacy.

## 13. Privacy Model

- The SE's blindness (no value, no parties) is preserved per member; the
  redesign changes *key management*, not the blinding protocol.
- **Federation is a privacy threshold:** any minority below `k` cannot
  deanonymize; `k` colluding members can. State this wherever federation is
  offered.
- On-chain, only claim/reclaim reveal the custody chain; the witness reveals the
  signing member subset. Both are documented surfaces.

## 14. Cost & Economics

- **Script size:** `n` leaf keys at 32 bytes each — linear, small.
- **Witness size:** each SE signature is large (WOTS/TreeKey); `k`-of-n
  multiplies it at claim. This argues for **per-state flat leaf signatures**
  rather than carrying tree proofs on-chain, and for keeping `k` modest.
- **Fees:** per-member, per-event accounting via `onSign`; federation fee
  settlement is a Phase 4 deliverable.
- **Registry:** extend the existing 7-day announce/TTL with per-member identity
  and bond references (Phase 2).

## 15. Compatibility & Migration

- **No back-compat (pre-release).** Wire/on-disk changes ship with explicit
  versions; per RFC-007 §4.2, unsupported versions **refuse to open** rather
  than silently reinitialise, and committed material is never silently
  re-encoded.
- **Script template versioning:** v2 (single SE, dedicated leaf) → v3 (k-of-n);
  the chain does not force one version on all statechains, but a given chain's
  template is fixed at creation.
- **Client-side durable store** (RFC-007 Phase 4) is extended to persist the
  federation descriptor and per-transfer member records.

## 16. Open Questions

1. **Exact on-chain composition** of "owner AND k-of-n" in KISSVM (assert
   ordering, MULTISIG parameter semantics) — confirm against the evaluator.
   The witness/signature model is resolved: **RFC-009** landed TreeKey
   `SignatureProof` verification and its on-chain gate passes.
2. **Member leaf binding timing:** fixed set at `/create`, or a member set that
   can widen with a versioned descriptor while preserving the original script's
   authorization?
3. **Claim-leaf vs transfer-leaf separation:** is one dedicated claim leaf per
   statechain sufficient, or must the claim leaf also be federated `k-of-n`?
4. **Equivocation log:** append-only public log vs. gossip vs. on-demand proof
   publication — what is the minimum viable detection surface?
5. **Bonding/slashing:** bond asset, dispute window, adjudicator (on-chain vs.
   bonded committee), and interaction with the Axia registry.
6. **`k` policy:** fixed per federation, or per-statechain chosen by the owner?
7. **Go SE:** implement real interoperable WOTS with cross-language known-answer
   tests, or permanently retire the Go SE as a non-SE reference?

## 17. References

- Audit findings: AUD-003 (SE index-0 reuse), AUD-025 (advertised key
  mismatch), AUD-045 (Go placeholder), AUD-004/005 (wots-lease allocation),
  AUD-026/027/029 (SE hardening) — `audit/REPORT.md`.
- RFC-007: storage consolidation, durable guarantees, state versioning, and the
  accounting-authority principle this RFC reuses for leaf allocation.
- Existing building blocks: `@totemsdk/root-identity`
  (`UnifiedIdentityWallet`, `OwnershipProof`, `WotsProof`), `@totemsdk/identity`,
  `@totemsdk/wots-lease` (`LocalLeaseProvider`), `@totemsdk/proof`
  (`signWithLease`, `signProof`), `@totemsdk/core` (`TreeKey`,
  `verifyTreeSignature`, MMR), `@totemsdk/se-server`, `@totemsdk/statechain`.
