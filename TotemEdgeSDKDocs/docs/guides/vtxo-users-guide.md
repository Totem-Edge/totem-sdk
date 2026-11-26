---
id: vtxo-users-guide
title: The VTXO User's Guide
sidebar_label: VTXO User's Guide
description: A field guide to bearer claims on Minima — the four layers, every payload class, the claim-policy catalogue, twelve product patterns, and the path to a policy-aware claim rail.
---

# The VTXO User's Guide

**Bearer claims on Minima: what a VTXO can hold, who can claim it, and why it is a new primitive.**

> A VTXO is not a coin. It is a claim — and the claim is the product.

**Designed edition:** [Download the PDF](/downloads/VTXO-Users-Guide.pdf). The self-contained HTML edition is at `static/downloads/VTXO-Users-Guide.html`.

| | |
|---|---|
| **Audience** | Builders, issuers, product designers, and the merely curious |
| **Companion** | The Vouchar claim app (this repository) |
| **Grounded in** | `@totemsdk/vtxo` 0.9.x, `omnia-pool`, `liquidity-bond`, `kissvm`, `statechain` (November 2026) |
| **Status** | Living document. Mechanics and maturity labels reflect the SDK as inspected; product ideas are labelled as ideas. |

### How to read the badges

| Badge | Meaning |
|---|---|
| ✅ **Now** | Supported by the SDK today. MVP caveats still apply — read §14. |
| 🧩 **Designed** | Typed, specified, or partially implemented in the SDK/repo, but not production-hardened. |
| 💡 **Idea** | A product concept. No implementation. Useful, not promised. |

---

## 0. The 60-second version

- A **VTXO** (virtual transaction output) is a **bearer claim on a pool of on-chain capacity**.
- The pool operator holds the on-chain UTXO. The holder holds a proof in a Merkle commitment tree.
- VTXOs can be **minted, transferred, split, merged, refreshed, and exited** without a live Minima node per operation.
- On top of the bearer value, a VTXO can carry a **claim policy**: who may claim, when, and under what conditions.
- That combination — **bearer value + programmable claim** — is the new primitive.
- Almost every idea in this guide is a composition of two things: **a payload** and **a policy**.

The rest of the guide is the long version of that sentence.

---

## 1. The mental model: four layers

A voucher, a ticket, a grant, an agent budget and a bearer bond are the same object viewed through four independent layers.

```
        ┌──────────────────────────────────────────┐
        │  TRANSPORT                               │
        │  email link · QR · NFC · BLE · print     │
        └───────────────────┬──────────────────────┘
                            ▼
        ┌──────────────────────────────────────────┐
        │  CLAIM POLICY                            │
        │  who / when / under what conditions      │
        └───────────────────┬──────────────────────┘
                            ▼
        ┌──────────────────────────────────────────┐
        │  PAYLOAD                                 │
        │  what is actually being claimed          │
        └───────────────────┬──────────────────────┘
                            ▼
        ┌──────────────────────────────────────────┐
        │  SETTLEMENT                              │
        │  how the payload moves                   │
        └──────────────────────────────────────────┘
```

| Layer | Question it answers | Examples |
|---|---|---|
| **Payload** | What is being claimed? | MINIMA, token, NFT, basket, VTXO, statechain UTXO, LP position, proof, manifest, mandate, dataset, encrypted backup |
| **Claim policy** | Who can claim, when, under what conditions? | Bearer secret, KISSVM script, time lock, vesting, threshold, HTLC, DvP, oracle, delegated, recovery, revocable |
| **Settlement** | How does the payload actually move? | Treasury payout, direct script spend, VTXO transfer, statechain cooperative claim, Omnia payment, LP withdrawal, proof/manifest delivery, encrypted-data delivery |
| **Transport** | How does the secret reach the claimant? | Email link, QR, NFC, BLE, printed code, physical object |

**The important design insight: payload and policy are independent.**

A MINIMA voucher can be a plain bearer gift, a vesting grant, a DvP sale, a guardian-recoverable inheritance, or a budget for an agent. An NFT voucher can be a collectible, a ticket, a membership, a licence, or a for-sale lot. The envelope does not need to know every product; it needs a **payload union** and a **policy union**.

That is also the design thesis of this guide: build the envelope once, then compose products.

---

## 2. VTXO mechanics in 60 seconds

### The pool

A **pool** is the on-chain anchor that backs a set of VTXOs. An operator creates it with a fixed capacity. Minting reduces available capacity; exiting returns capacity to the chain.

```ts
import { createPool } from '@totemsdk/vtxo';

const pool = createPool({
  operator: 'MxOperatorAddress',
  tokenId: '0x00',              // native MINIMA
  totalCapacity: BigInt(1_000_000_000),
  nonce: 'pool-genesis-v1',
}, Date.now());
// pool.poolId = SHA3-256(operator + tokenId + nonce) — deterministic
```

| Field | Meaning |
|---|---|
| `poolId` | Deterministic hash — never changes |
| `operator` | Minima address holding the on-chain backing UTXO |
| `tokenId` | Token this pool holds |
| `totalCapacity` | Total token units the pool can back |
| `availableCapacity` | Remaining mintable capacity |
| `epoch` | Advances on each batch refresh round |
| `commitmentRoot` | Current Merkle root over all live VTXOs |

### The lifecycle

```
        ┌──────── mint ────────┐
        ▼                     │
     active ──transfer──► transferred
        │
        ├─ partial-transfer ──► split  (input)
        ├─ split ────────────► split  (input)
        ├─ merge ────────────► merged (inputs)
        ├─ refresh ──────────► refreshed (old)
        ├─ exit_initiated ───► exiting ──► exited
        └─ spent ────────────► spent
```

| Operation | What it does |
|---|---|
| **Mint** ✅ | Creates a VTXO and reduces pool capacity |
| **Transfer** ✅ | Moves a VTXO to a new owner |
| **Split** ✅ | Divides one VTXO into pieces that sum to the original |
| **Merge** ✅ | Combines VTXOs from the same pool and token |
| **Refresh** ✅ | Re-anchors a VTXO against a new pool epoch |
| **Exit** 🧩 | Returns value to the chain; the V1 owner-pool covenant provides a unilateral path |
| **Verify** ✅ | `verifyVtxo` checks proof fields; `verifyConservation` checks inputs = outputs |

Terminal states are `transferred`, `split`, `merged`, `refreshed`, `spent`, and `exited`.

### Why not just use a statechain?

| | Statechain | Omnia VTXO |
|---|---|---|
| Ownership transfer | Blind SE co-signature | Pure functional, no live signing needed |
| Privacy model | Blind Mercury SE | Local commitment root |
| Splitting | Not supported | Native |
| Merging | Not supported | Native |
| Exit model | On-chain UTXO handoff | Pool epoch settlement / per-share exit |
| Best fit | Privacy UTXO custody | Merchant receipts, credits, pool liquidity |

They are siblings, not replacements. §5 treats both as payloads.

---

## 3. What a VTXO is *not*

A guide that only sells the idea is not a guide. These are the corrections that matter.

| Myth | Reality |
|---|---|
| "A VTXO is a coin you own on-chain." | The **operator** holds the on-chain UTXO. You hold a claim proof. The claim becomes an on-chain entitlement only through an exit path. |
| "A VTXO is just an IOU." | An IOU names an issuer. A VTXO is a **bearer claim against committed capacity**, verifiable against a Merkle root. The difference is enforceability of the exit, not politeness. |
| "VTXOs are automatically private." | Bearer links leak. Amounts, timing and redemption are linkable. Batching helps; it is not a mixer. |
| "VTXOs are permissionless bearer cash." | Not yet. Pooled transfer of arbitrary recipients is deliberately gated (§14). The V1 path is an **owner-state claim coin** with a unilateral exit. |
| "A VTXO expires on-chain." | As of 0.9.x, `expiresAt` is **untrusted metadata**: it is not in the leaf, `verifyVtxo` does not enforce it, and transfer drops it. Product expiry is enforced by the claims service at reservation. |
| "Transfer is final immediately." | A recipient must wait for the owner-rotation transaction to confirm. Before confirmation, the previous owner can win the race to exit. |
| "Split/merge are free." | They are cheap, but each mutation is a commitment update and eventually an anchor. Economics matter (§11). |
| "The operator can't cheat." | The current model has no watchtower and no equivocation detection. Operator trust is reduced, not eliminated, until watchtowers and pool-wide epoch roots ship. |

**Design rule:** never market a VTXO property that the current covenant does not enforce. The SDK's own docs are explicit about this, and the app's readiness report encodes the same gates.

---

## 4. The claim-policy catalogue

A VTXO is single-owner by default. Policies let the claim itself be conditional. The SDK evaluates them in `verifyClaimPolicy` (pure) and `verifyVtxoClaim` (authoritative: requires signatures over a canonical preimage, verified signer identities, and optionally a chain tip).

| Policy | One-line meaning | Status |
|---|---|---|
| `single` | One owner, plain bearer | ✅ |
| `threshold` | M-of-N owners must sign | ✅ |
| `conditional` | HTLC-style: claim with preimage before timeout, otherwise refund | ✅ |
| `dvp` | Delivery-versus-payment: claim only when the matching payment settles | ✅ |
| `delegated` | A delegate may claim or transfer within scope and time | ✅ |
| `rotation` | Operator handover at a block height | ✅ |
| `vesting` | Only the vested portion is claimable, floored, over a schedule | ✅ |
| `recovery` | Guardians can recover after a block if the owner does not act | ✅ |
| `collateral` | Counterparty-bound collateral with optional release height | ✅ |

### 4.1 `single` — the bearer note

Fields: `owner`.

**Feels like:** cash in an envelope. Whoever holds the secret and the owner key can claim.

**Use it for:** gifts, promo drops, merchant credit, refunds, physical redemption.

**Watch:** losing the link loses the value. There is no recovery unless you add one.

### 4.2 `threshold` — shared custody without a custodian

Fields: `threshold`, `owners[]`.

**Feels like:** a joint bank account, or a 2-of-3 safe.

**Use it for:** rent deposits (tenant + landlord + arbiter), DAO treasuries, family savings, escrow without a company.

**Novel instance — *The Three-Key Deposit* 💡:** tenant, landlord, and a mutually chosen arbiter. Day-to-day release needs two keys; a disputed exit needs the arbiter. The deposit is a bearer claim, not a platform balance.

**Watch:** key loss becomes a governance problem. Pair with `recovery` or a documented replacement ceremony.

### 4.3 `conditional` — the hashlock envelope

Fields: `owner`, `refundOwner`, `hashlock`, `timeoutBlock`; witness path is `claim` or `refund`.

**Feels like:** a vending machine that only opens when you know the code — and returns your money if you never do.

**Use it for:** escrow-lite, bounties, delivery-versus-description, lost-property rewards, API pay-per-call.

**Novel instance — *The Rain Cheque* 💡:** an SLA compensation voucher. An oracle publishes an attestation that the service missed its target; the attestation's preimage unlocks every subscriber's claim. No support ticket, no discretionary credit.

**Watch:** the oracle is now part of the trust model. Say so.

### 4.4 `dvp` — delivery versus payment

Fields: `owner`, `counterparty`, `paymentId`, `hashlock`, `timeoutBlock`.

**Feels like:** a marketplace escrow that settles atomically.

**Use it for:** NFT sales, ticket resale at face value, OTC swaps, physical goods with a shipping attestation.

**Novel instance — *The Self-Selling Artifact* 💡:** the voucher is simultaneously the asset, the listing and the escrow. See §7.2.

**Watch:** this is the policy that forces the reservation core to become payment-aware. It is not a UI variant; it is a state-machine change.

### 4.5 `delegated` — permission without custody

Fields: `owner`, `delegate`, `scope` (`claim` | `transfer`), `expiresAtBlock`, `revoked?`.

**Feels like:** a company card with a limit, a scope and an expiry.

**Use it for:** agent budgets, contractor allowances, device spending, API keys with value attached.

**Novel instance — *The Robot's Warrant* 💡:** a manifest + mandate + budget VTXO. The agent can act only within scope, up to budget, until expiry; the owner can revoke; unspent budget returns. See §7.3.

**Watch:** delegation is authorization, not accounting. Usage counters and budget reservation live above the VTXO layer.

### 4.6 `rotation` — planned handover

Fields: `fromOperator`, `toOperator`, `rotateAtBlock`.

**Feels like:** a domain transfer, or a change of bank.

**Use it for:** operator migration, estates, succession, pool acquisitions.

**Watch:** rotation changes who anchors the pool. It does not by itself move value between pools.

### 4.7 `vesting` — the time-shaped right

Fields: `owner`, `beneficiary`, `startBlock`, `cliffBlock`, `endBlock`, `totalAmount?`.

**Feels like:** a vesting schedule you can hold in your hand.

**Use it for:** contributor grants, scholarships, salary advances, rent-free periods, warranty rebates.

**Novel instance — *The Seed Packet* 💡:** a contributor claims monthly; only the vested portion is claimable; the unvested remainder returns to the treasury after `reclaimAfter`. See §7.1.

**Watch:** vesting math floors, never rounds up. Partial claims break the one-shot `reserved → settled` model.

### 4.8 `recovery` — the dead-man switch

Fields: `owner`, `guardians[]`, `threshold`, `recoverAfterBlock`.

**Feels like:** a spare key held by people you trust, usable only if you go silent.

**Use it for:** inheritance, wallet recovery, scholarship guardianship, corporate continuity.

**Novel instance — *The Inheritance Switch* 💡:** an encrypted backup plus a VTXO plus guardians. If the owner does not heartbeat by block *N*, the guardians can release the claim to the heirs; the claim secret also derives the decryption key for the off-chain payload.

**Watch:** guardians can collude. Choose a threshold and a social process, not just a number.

### 4.9 `collateral` — value at risk

Fields: `owner`, `counterparty`, `releaseAtBlock?`.

**Feels like:** margin in an exchange account, but the margin is a bearer claim with a per-share exit.

**Use it for:** trading margin, prediction markets, insurance pools, performance bonds.

**Novel instance — *The Prediction Position* 💡:** two counterparties lock claims on the same pool; an oracle attests the outcome; the winner claims, the loser's claim expires. Per-share exit lets either side pull collateral if the operator misbehaves.

**Watch:** collateral is only as good as the oracle and the exit path.

### Policy composition

Policies are a union, not a stack, in the current SDK. Composition happens at a higher layer: a mandate payload can *reference* a vesting claim, a threshold can gate a recovery, and a DvP can be wrapped in a vesting schedule by the issuer's service. The guide treats composition as a **product-layer** concern, which is exactly why the claim app needs a policy union rather than a single `policy` string.

---

## 5. The full payload catalogue

This is the long list. It is deliberately generous: the point is not that every row is a product, but that the envelope should not artificially exclude any of them.

### 5.1 On-chain bearer payloads

| Payload | What it is | SDK / mechanism | Status |
|---|---|---|---|
| **Native MINIMA** | `tokenId 0x00` | `tx-builder`, `minima-rpc` | ✅ |
| **Fungible token** | Any token ID, 0–44 decimals; the token itself may have a restrictive script | `connect`, `tx-builder` | ✅ |
| **NFT** | Token with total supply `1`, decimals `0`, `artimage` + attributes; `signtoken` proves authorship | `connect`, `realtime` | ✅ |
| **Multi-asset basket** | One claim releases several coins/tokens at once | `tx-builder` | 🧩 |
| **Stateful coin** | Coin with `STATE(port)` values: counters, membership, game state, vesting progress | `kissvm`, `recursive-mast` | ✅ |
| **Time-shaped coin** | Linear release, cliff, deadline, window, rate-limit, decay | `kissvm` temporal templates | ✅ |
| **Threshold/multisig coin** | M-of-N claim, guardian recovery | `kissvm`, `tx-builder` | ✅ |
| **HTLC coin** | Hashlock + timeout; claim or refund | `tx-builder` | ✅ |
| **Oracle-conditioned coin** | Releases only when an oracle commitment is satisfied | `kissvm` | 🧩 |
| **MAST/policy-tree coin** | Nested policy branches, delegation, rotation, revocation | `recursive-mast`, `kissvm` | ✅ |
| **Statechain UTXO** | Any token/NFT transferred off-chain with SE blind signatures; on-chain claim or timelock reclaim | `statechain` | ✅ |
| **Omnia VTXO** | Off-chain cash-like claim on a pool; tokenId + amount + owner + claim policy; split/merge/refresh/exit | `omnia-vtxo` | ✅ |
| **Omnia channel/factory share** | Capacity or settlement right in an eltoo channel/factory | `omnia`, `omnia-factory`, `omnia-splice` | 🧩 |
| **Liquidity position/receipt** | LP capital, fee share, lock terms, withdrawal right | `liquidity-bond`, `omnia-pool` | 🧩 |
| **Collateral/margin bond** | Locked collateral with maturity/exercise/exit rules | `kissvm`, `eefi` | 🧩 |
| **Provider bond certificate** | Bonded-provider claim/reputation record (data-only in v0.1, not escrow) | `provider-bond` | 🧩 |

### 5.2 Contractual and financial payloads

| Payload | What the claim transfers |
|---|---|
| **Revenue share / fee stream** | Right to future fees from a pool, channel, or merchant flow |
| **EEFI capital agreement** | Committed capital with funding/operation/settlement terms |
| **EEFI market quote** | A signed, finite buy/sell quote; claim = exercise or take the quote |
| **EEFI exercise covenant** | Unilateral exercise, liquidation, or maturity redemption right |
| **Risk policy** | Insurance/risk terms with haircuts, collateral ratios, oracle conditions |
| **Option / put / call** | Right to buy/sell at a strike before a deadline |
| **Debt or penalty** | A negative asset: the claim transfers an obligation, not a balance |
| **Return/refund right** | A put on a physical or digital good |
| **Service credits** | Compute, storage, API, AI inference, bandwidth |
| **Physical redemption** | Merch, ticket, coffee, repair, signed-for delivery |

### 5.3 Credential, capability, and data payloads

| Payload | What the claim transfers |
|---|---|
| **Signed proof** | Attestation, ownership, capability, revocation, delegation, manifest, identity, custom |
| **Signed manifest** | App, capability, dApp, or edge-service declaration |
| **Authority mandate** | Scoped permission with constraints, usage limits, expiry, revocation |
| **Root identity child** | One of 64 addresses under a root identity; ownership proof |
| **Dataset capability** | Dataset descriptor, checkpoint, replicated log/index access |
| **Encrypted backup** | Ciphertext + decryption capability; the claim secret can derive the key |
| **Location proof** | Proof of presence, movement trail, geofence relation |
| **Spatial proof** | Distance/containment/route relation between objects |
| **Raster proof** | Visual evidence, tile Merkle roots, derived-layer provenance |
| **Governance right** | Vote, delegation, membership weight, proposal execution |
| **WOTS lease** | A key-use reservation/certificate (a claimable right, not usually a bearer asset) |

### 5.4 The SDK's own documented use-case list

From the Meridian VTXO payments example — the canonical "what fits" list:

- **Streaming / metered payments** — split a tranche per tick (per second, per API call, per kWh).
- **Prepaid transit & event passes** — a bearer ticket; split off a ride/seat; transferable; expiring by pool epoch.
- **Loyalty / gift / merchant credit** — off-chain bearer credit redeemable at any pool member; merge points, split to redeem.
- **Micropayment aggregation for IoT** — millions of device payments collapse into epoch roots instead of on-chain dust.
- **Payroll / allowance** — mint an epoch's claim, split per person; recipients spend or transfer without a bank rail.
- **Escrow-lite / condition-gated bearers** — transfer co-signed only when an off-chain condition holds; escrow without a separate UTXO.
- **Rollup-style batched settlement** — the pool as a generic batching lane; many transfers, one anchor, per-share exit as the escape hatch.
- **Collateral / margin bearers** — hold margin as VTXOs; refresh keeps them current; per-share exit pulls collateral unilaterally.
- **Ticket / queueing (NFT-ish)** — a transferable right to a scarce slot; the pool epoch is the freeze point.
- **Multi-asset pockets** — one pool per tokenId; a wallet holds a pocket per asset with the same primitives.

### 5.5 Other payloads worth designing for

| Voucher | What it holds | Why it's interesting |
|---|---|---|
| **Liquidity Share** | `LiquidityPosition` + `LiquidityReceipt` + fee policy + lock terms | A claimable income-producing position, not just a token |
| **Statechain Cash** | A private UTXO (any token/NFT) transferred off-chain | High-value or privacy-sensitive bearer asset; cooperative claim or timelock reclaim |
| **Digital Inheritance** | Encrypted backup + proof + time window | Claim secret decrypts the data; dead-man switch; on-chain amount + off-chain payload |
| **Proof-of-Attendance** | Location/spatial proof + NFT + manifest | Claim only at the venue; provenance-rich POAP |
| **Governance Seat** | Vote/delegation + mandate | Claim to vote or delegate; execution bound to the outcome |
| **Option / Quote** | EEFI market agreement + exercise covenant | Claim to exercise a call/put at a strike before expiry |
| **Dataset Access** | Replication descriptor + checkpoint + encrypted backup | Claim a capability to a dataset, not a balance |
| **Provider Bond** | Provider bond certificate/ref | Claim to become a bonded provider; note this is data-only in v0.1 |
| **Transit/Event Pass** | Bearer VTXO ticket | Split per ride/seat; transferable; expires by epoch |
| **Streaming Salary** | VTXO split per tick or linear release | Continuous claim, not monthly batch |
| **Collateral/Margin** | Collateral VTXO + exit right | Per-share unilateral exit; useful for trading and credit |

---

## 6. The gallery: 12 patterns, not 100 features

Every use case in §5 is an instance of one of twelve patterns. Learn the patterns and the product ideas generate themselves.

### Pattern 1 — Prepaid bearer credit

**What it is:** value is paid forward, held as a bearer claim, and redeemed later at one or more merchants.

**Why a VTXO:** no per-redemption on-chain fee; merge to consolidate; split to redeem exact amounts; recipient needs no account.

**Instances**

- **Loyalty / gift / merchant credit** ✅ — issue a batch, redeem at any pool member.
- **Multi-asset pockets** ✅ — one pocket per token, same primitives.
- **The Open Tab** 💡 — a bar tab as a VTXO: open with 50, split per round, friends top it up, merge the remainder at close.
- **Community Fridge** 💡 — sponsors mint small claims; neighbours redeem at participating shops; merchants merge at week's end.

**Design note:** denomination matters. Pre-split into note-like pieces at issuance (a "denomination ladder") to avoid a split storm at redemption.

### Pattern 2 — Metered and streaming value

**What it is:** value is released continuously or per unit of consumption.

**Why a VTXO:** native split per tick; the remainder stays pooled and refreshable; no monthly batch.

**Instances**

- **Streaming / metered payments** ✅ — per second, per call, per kWh.
- **Streaming salary** 💡 — work streams, pay streams; stop work, stop vesting.
- **Energy purse** 💡 — tokenised kWh credits split per charging session.
- **Pay-per-view / pay-per-word** 💡 — unlock a segment with a micro-claim; the rest stays locked.

**Design note:** the meter is a policy problem, not a payment problem. Pair the VTXO with a KISSVM meter or an oracle attestation; otherwise "streaming" is just frequent invoicing.

### Pattern 3 — Batched settlement and rollups

**What it is:** many small transfers collapse into one periodic on-chain anchor.

**Why a VTXO:** the pool *is* the batching lane; the epoch root is the receipt; per-share exit is the escape hatch.

**Instances**

- **Micropayment aggregation for IoT** ✅ — device payments become epoch roots, not dust.
- **Rollup-style settlement** ✅ — a generic lane for any asset.
- **Exchange / merchant withdrawals** 💡 — batch customer payouts, anchor once.
- **Machine roaming** 💡 — a device spends across operators; settlement nets at the epoch.

**Design note:** batching changes the risk profile. The longer the epoch, the more you rely on the operator between anchors. Publish the exit path and the anchor cadence.

### Pattern 4 — Conditional escrow ("escrow-lite")

**What it is:** the claim unlocks only when an external condition is proven; otherwise it refunds.

**Why a VTXO:** an HTLC-style policy gives escrow semantics without a separate UTXO or a custodian.

**Instances**

- **Escrow-lite** ✅ — condition-gated bearer.
- **Freelance milestones** 💡 — deliverable hash unlocks the tranche; timeout refunds the client.
- **Lost-dog bounty** 💡 — return attestation unlocks; expiry when the dog comes home.
- **The Rain Cheque** 💡 — oracle-attested SLA failure unlocks compensation automatically.

**Design note:** name the oracle. "Trustless escrow" with an unnamed attestor is marketing, not design.

### Pattern 5 — Delivery versus payment

**What it is:** the asset moves only if the payment moves, atomically.

**Why a VTXO:** the `dvp` policy binds owner, counterparty, payment ID, hashlock and timeout in one claim.

**Instances**

- **NFT / collectible sale** 💡 — the link is the listing.
- **Ticket resale at face value** 💡 — the issuer caps the resale price by policy, killing scalping.
- **OTC swap** 💡 — two claims cross-settle.
- **Physical goods with shipping attestation** 💡 — payment releases on proof of dispatch.

**Design note:** DvP is the policy that breaks a one-shot claim model. Build it early; it forces the right abstractions.

### Pattern 6 — Time-shaped rights

**What it is:** the claim's value is a function of time — vesting, cliff, window, decay.

**Why a VTXO:** `vesting` is a first-class policy with floored partial claims.

**Instances**

- **Seed Packet** 💡 — contributor grant with cliff and linear vest; unvested returns.
- **DAO grant tranches** 💡 — milestone + vesting + revocation.
- **Rent deposit release** 💡 — deposit vests back to the tenant after inspection.
- **Warranty rebate** 💡 — a no-claim rebate that unlocks after 12 months.

**Design note:** partial claims are the hard part. The reservation core must support repeated claims against one voucher and track claimed-to-date.

### Pattern 7 — Delegated authority (the agent economy)

**What it is:** the claim transfers permission, with a budget attached.

**Why a VTXO:** `delegated` scopes claim/transfer, expires at a block, and can be revoked; the budget is a payload.

**Instances**

- **Robot's Warrant** 💡 — manifest + mandate + budget for an AI ops agent.
- **Agent budget** 💡 — a company card that expires and can be cancelled.
- **Bearer API key with value** 💡 — the key is the claim; the budget is the blast radius.
- **Contractor allowance** 💡 — scoped spend for a season.

**Design note:** this is where VTXOs stop being payments and become **authorisation infrastructure**. Usage accounting, revocation and budget reservation live above the chain; the chain enforces the ceiling.

### Pattern 8 — Recoverable and inheritable claims

**What it is:** a claim that can be recovered by trusted parties if the holder disappears.

**Why a VTXO:** `recovery` gives guardians a threshold and a block-height trigger.

**Instances**

- **Digital inheritance** 💡 — heartbeat, guardians, encrypted payload.
- **Scholarship guardianship** 💡 — student + school + sponsor.
- **Corporate continuity** 💡 — a departing operator's keys are recoverable by a board threshold.
- **Wallet recovery** 💡 — social recovery for a bearer balance.

**Design note:** recovery is a social protocol wearing a cryptographic hat. Document the ceremony, not just the threshold.

### Pattern 9 — Collateral and margin

**What it is:** value is locked against a counterparty or an obligation.

**Why a VTXO:** `collateral` binds owner and counterparty; refresh keeps it current; per-share exit lets the holder pull out.

**Instances**

- **Prediction position** 💡 — winner-takes-the-lock, oracle-resolved.
- **Trading margin** 💡 — per-share exit, no exchange custody.
- **Three-key rent deposit** 💡 — tenant/landlord/arbiter threshold.
- **Micro-insurance pool** 💡 — premiums merge; claims need attestation.

**Design note:** collateral without a credible exit is just a promise. The exit path is the product.

### Pattern 10 — Scarce-slot rights (tickets, queues, licences)

**What it is:** a transferable right to a scarce thing: a seat, a slot, a licence, a membership.

**Why a VTXO:** NFT-like uniqueness with cash-like split/transfer; epoch is the freeze point.

**Instances**

- **Prepaid transit & event passes** ✅ — split per ride/seat; transferable.
- **Ticket / queueing** ✅ — a right to a slot, not a JPEG.
- **Membership / season pass** 💡 — transferable until the freeze block.
- **Licence seat** 💡 — a software seat that can be lent, not copied.

**Design note:** decide whether the right is *unique* (NFT payload) or *fungible within a class* (token payload). The answer changes the settlement path.

### Pattern 11 — Payroll, allowances and distribution

**What it is:** one funding event fans out to many recipients.

**Why a VTXO:** mint once, split per person, recipients spend or transfer; unclaimed value rolls forward.

**Instances**

- **Payroll / allowance** ✅ — an epoch's claim split per person.
- **Scholarship stipend** 💡 — vesting + guardian recovery.
- **Per-diem / travel float** 💡 — expires at trip end; unspent returns.
- **Referral cascade** 💡 — commission splits down a chain of referrers; uncashed hops merge back.

**Design note:** distribution is where expiry and reclaim earn their keep. Unclaimed payouts should return to the next run, not sit dead.

### Pattern 12 — Proof-carrying physical redemption

**What it is:** the claim redeems a physical thing, and the claim carries the proof that makes the redemption credible.

**Why a VTXO:** payload can include proofs, manifests and location/raster attestations; policy can require presence.

**Instances**

- **Proof-of-attendance** 💡 — claimable only at the venue.
- **Deposit-return cup** 💡 — returning the cup produces a proof that releases the deposit.
- **Warranty wallet** 💡 — proof of purchase + service credit.
- **Library of Things** 💡 — refundable deposit + rental fee; return proof releases the deposit.
- **Open Studio** 💡 — a print's NFT + raster + location proof is the certificate of authenticity.

**Design note:** the proof is the product. If the attestation is forgeable, the physical redemption is theatre.

### The idea shelf

Quick-fire concepts that did not need a full pattern. All 💡 unless noted.

| Idea | One line |
|---|---|
| **The Disappearing City Hunt** | 200 hidden QR vouchers, a golden ticket, sunset expiry; reclaimed funds finance the next hunt. |
| **Last-Call Jackpot** | A pub-quiz code expires at midnight; the unclaimed pot rolls into next week's bigger jackpot. |
| **Secret Santa That Comes Back** | An emailed bearer gift, regiftable by forwarding; returns to sender if unclaimed. |
| **Group Gift** | Many contributors merge into one claim; the recipient splits it; unclaimed splits back proportionally. |
| **Split-the-Bill** | One table voucher splits by headcount; each diner pays their part. |
| **Tournament Pot** | Entry fees merge; an oracle attests the winner; unclaimed pot rolls over. |
| **Arcade High-Score** | The cabinet prints a claim code; unclaimed scores fund the next prize. |
| **Reusable Wristband** | Split per drink/food, transferable to a friend, leftover refunded at the gate. |
| **Pay-it-forward coffee tab** | A code on a receipt, good for one coffee, expires in 24 hours. |
| **Office snack fund** | Expires Friday 5pm; unclaimed money returns to next week's fund. |
| **The Regift Chain** | Each forward rotates the secret and appends a receipt, producing a provenance chain of gifting. |
| **The Scholarship** | Vesting per term, 2-of-3 release (student, school, sponsor), guardian recovery. |

---

## 7. Three designs in full

### 7.1 The Seed Packet — a voucher that holds a vesting schedule

**Payload:** project token or MINIMA held as an Omnia VTXO with a `vesting` policy (`startBlock`, `cliffBlock`, `endBlock`, `totalAmount`), or a KISSVM cliff+linear release coin.

**Policy:** `vesting`, optionally composed with `recovery` for a disappeared contributor.

**Settlement:** partial VTXO claims per period; the unvested remainder returns to treasury after `reclaimAfter`.

**Transport:** email link, wallet-gated claim page.

**Flow**

1. Treasury mints one VTXO per contributor (or one pool piece per cohort).
2. The claim page shows a growth ring, not a balance.
3. At each period, the contributor claims the newly vested portion.
4. If they disappear past the reclaim date, the treasury reclaims the unvested remainder.

**Why it's deep:** the voucher holds a **time-shaped right**, not a lump sum. Claims are partial and repeatable. This breaks the current one-shot `reserved → settled` model and forces the state machine to become policy-aware. It also removes the need for a vesting dashboard or a custody provider.

**Failure modes:** chain-tip manipulation (mitigated by `chainTip` in `verifyVtxoClaim`); rounding disputes (floor and publish the formula); abandoned vesting (reclaim path).

### 7.2 The Self-Selling Artifact — an NFT that sells itself

**Payload:** an NFT (token amount 1 + metadata/artimage/attributes) plus a provenance bundle: `signtoken` authorship, a raster proof of the physical item, a spatial/location proof from the studio, an ownership proof, and a signed manifest.

**Policy:** a `dvp` claim policy (owner, counterparty, payment ID, hashlock, timeout block) or a conditional HTLC.

**Settlement:** atomic payment-versus-transfer; unsold inventory returns to the artist at timeout.

**Transport:** the link is the listing. A QR on the print, a link in the gallery, an NFC tag on the frame.

**Flow**

1. Artist mints the NFT and assembles the proof bundle.
2. The claim link is published as the listing, with an ask and a deadline.
3. A buyer claims by paying the ask; the NFT and proofs transfer atomically.
4. If unsold by the deadline, the artist reclaims.

**Why it's deep:** the voucher is simultaneously the **asset**, the **listing**, and the **escrow**. The claim is payment-gated, not just signature-gated. Provenance is part of the payload, not a separate database. This is a marketplace primitive built from a bearer link.

**Failure modes:** stale proof (bind proofs to the claim preimage); payment race (single-use payment ID); resale price manipulation (cap resale by policy if desired).

### 7.3 The Robot's Warrant — a voucher that holds authority

**Payload:** a signed `Manifest` (capability), an `Authority Mandate` (scope, constraints, usage limits, expiry), a budget (VTXO or token amount), and a `Proof` envelope.

**Policy:** mandate verification plus a `delegated` claim policy (owner, delegate, scope, `expiresAtBlock`), or KISSVM mandate/usage-tracking scripts.

**Settlement:** the agent claims the warrant; it can act only within scope, up to budget, until expiry; unspent budget returns.

**Transport:** an API credential, a QR, or an agent-to-agent handoff.

**Flow**

1. A DAO mints a warrant for an AI ops agent: 5 MINIMA, whitelisted vendors, until block *N*.
2. The agent claims the warrant and operates.
3. Usage is metered off-chain; settlement is on-chain.
4. The DAO revokes; leftover budget returns.

**Why it's deep:** the voucher holds **permission**, not money. The budget is secondary; the real asset is the authority. Usage tracking, revocation, and scope are first-class. This is the primitive for the agent economy: hire an agent with a company card that expires and can be cancelled.

**Failure modes:** scope creep (encode allowlists in the mandate, not the prompt); revocation lag (short expiry windows); budget overrun (reserve, don't just check).

---

## 8. The claim lifecycle, end to end

### 8.1 The product states (what Vouchar implements today)

```
created → issued → reserved → settling → settled
              ↘ expired → reclaiming → reclaimed
              ↘ cancelled
reserved/settling/expired → manual_review → settled | reclaiming | cancelled
```

| State | Meaning |
|---|---|
| `created` | Campaign draft; no vouchers yet |
| `issued` | Voucher exists, secret committed, claimable until `claimDeadline` |
| `reserved` | A wallet has bound the claim; settlement is pending |
| `settling` | Payout is building/signed/broadcast |
| `settled` | Confirmed at the required depth |
| `expired` | Claim window closed without a claim |
| `reclaiming` | Funds returning to the treasury |
| `reclaimed` | Returned and reconciled |
| `manual_review` | Exception queue for ambiguous failures |

### 8.2 The same lifecycle with VTXO settlement

| Product state | VTXO-side meaning |
|---|---|
| `created` | Pool not yet funded; capacity reserved |
| `issued` | VTXO minted and held by the treasury/operator (or a recipient pool funded) |
| `reserved` | Claim session bound; VTXO not yet moved |
| `settling` | Transfer or exit broadcast; owner rotation pending |
| `settled` | VTXO active with the recipient (or L1 payout confirmed) |
| `expired` | Claim window closed; VTXO still active at the issuer |
| `reclaiming` | Exit/merge back into treasury capacity |
| `reclaimed` | Capacity restored and reconciled |

**Critical rule:** a VTXO transfer is not final until the owner-rotation transaction confirms. The product state `settled` must mean "confirmed", not "broadcast".

### 8.3 The eight steps of any claim

1. **Issue** — create the payload, bind the policy, commit the secret hash.
2. **Fund** — lock the backing (treasury L1, pool capacity, or owner coin).
3. **Deliver** — send the secret over the chosen transport; never log it, never put it in a query string.
4. **Open** — the claimant opens the link; the service creates a short-lived session.
5. **Prove** — the claimant proves wallet ownership (challenge signature).
6. **Reserve** — atomically bind the voucher to that wallet, once.
7. **Settle** — move the payload (L1 payout, VTXO transfer, statechain claim, proof delivery).
8. **Confirm and reconcile** — wait for finality, write the receipt, and make the outcome auditable.

Steps 4–6 are where most voucher systems fail. They are also where this app is strongest.

---

## 9. Design patterns and anti-patterns

### Do

- **Separate payload from policy.** The envelope should not know product names.
- **Make expiry a policy decision, not a UI countdown.** Enforce at reservation; label on-chain metadata as untrusted.
- **Pre-split at issuance.** A denomination ladder beats a split storm at redemption.
- **Treat the claim link as a capability.** One-time, fragment-only, rotatable, revocable.
- **Bind the claim to a wallet.** Bearer secret + wallet proof is phishing-resistant and prevents link theft from becoming payout theft.
- **Publish the exit path.** If a holder cannot exit, it is custody with extra steps.
- **Design the reclaim.** Unclaimed value should roll forward, not evaporate.
- **Meter above the chain.** Usage counters belong to the service; the chain enforces ceilings.
- **Make receipts portable.** A settlement receipt is also a reputation primitive.

### Don't

- **Don't call pooled VTXOs "permissionless bearer cash" yet.** The SDK explicitly reserves that claim until the exit gates pass.
- **Don't claim on-chain expiry** when `expiresAt` is metadata.
- **Don't put the secret in analytics, referrers, or server logs.**
- **Don't reuse a payment ID** in a DvP policy.
- **Don't conflate "reserved" with "settled".** The gap is where double-spends live.
- **Don't build an oracle-dependent product without naming the oracle.**
- **Don't assume batching is private.** Aggregation helps; it is not anonymity.
- **Don't let a guardian set be the only recovery plan.** Write the social ceremony.

---

## 10. Failure modes and threat model

| Failure | What happens | Mitigation |
|---|---|---|
| **Operator disappears** | Pool capacity is stranded; claims may be unenforceable | Per-share exit, owner-state claim coin, published operator policy, multi-operator pools |
| **Operator equivocation** | Two conflicting roots / receipts | Pool-wide epoch roots, watchtowers, receipt anchoring (🧩) |
| **Double claim** | Same voucher reserved twice | Atomic reserve, unique constraints, idempotency keys |
| **Link leakage** | Anyone with the link can attempt a claim | Wallet binding, short sessions, one-time secrets, rotation on forward |
| **Stale epoch** | A proof verifies against an old root | Epoch checks in acceptance; reject below the anchored epoch |
| **Replay** | A claim signature is reused in another context | Canonical preimage binding VTXO, owner, amount, pool, epoch |
| **Chain reorg** | A "confirmed" settlement reverses | Confirmation depth; reconcile; manual review |
| **Fee spike** | Exit or anchor becomes uneconomic | Fee budget in the pool policy; batch cadence |
| **Lost key** | Bearer value is lost | `recovery` policy, guardians, documented ceremony |
| **Guardian collusion** | Recovery steals the claim | Threshold + time delay + social accountability |
| **Oracle failure** | Conditional/DvP claims mis-settle | Multiple attestors, dispute window, refund branch |
| **Regulatory expiry** | Unclaimed value is legally abandoned | Jurisdiction-aware reclaim rules; escheatment process |

---

## 11. Economics and operations

- **Anchor cost vs claim value.** Batching only pays when the aggregate fee per claim is below the L1 payout cost. Publish the break-even.
- **Pool capacity is a balance sheet.** Minting consumes capacity; refreshing and exiting return it. Operators need a capacity policy, not just a script.
- **Exit cost is a promise.** If a unilateral exit costs more than the claim, the exit is decorative. Subsidise or batch exits.
- **Denomination ladder.** Issue a mix of note sizes so redemption rarely needs a split.
- **Epoch cadence.** Shorter epochs improve finality; longer epochs improve fee efficiency. Pick explicitly.
- **Operator selection.** Reputation, bond, uptime, exit history. A provider bond is a claimable record, not a guarantee.
- **Watchtower economics.** Someone must monitor disputes. If nobody is paid to watch, nobody watches.

---

## 12. Privacy, compliance, and human factors

**Privacy**

- A bearer link is cash-like for the holder and *terrible* for the sender if it leaks through email metadata, analytics, or screenshots.
- On-chain, exits and anchors are linkable by amount and timing. Aggregation helps; it is not anonymity.
- The claim service learns who claimed what. Minimise retention; hash what you must keep.

**Compliance**

- Stored-value and expiry rules vary by jurisdiction. A product-level expiry is not automatically a legal expiry.
- Decide where KYC happens: at issuance (issuer risk) or redemption (merchant risk). Both are defensible; ambiguity is not.
- Sanctions screening at claim time is cheaper than clawing back settled value.
- Email delivery is personal data. Retention and deletion belong in the product spec.

**Human factors**

- People screenshot links. Design for it: wallet binding, one-time use, visible "claimed" state.
- People lose links. Design for it: recovery policy or issuer reissue with audit.
- People forward gifts. Design for it: regift as a first-class action that rotates the secret and appends a receipt.
- People distrust countdowns. Show the *policy* ("claimable until 31 Dec"), not a fake on-chain timer.

---

## 13. Build map: which package for what

| Need | Package | Role |
|---|---|---|
| Pool + VTXO lifecycle | `@totemsdk/vtxo` | Spendable balances, claim policies, per-share exit |
| LP accounting | `@totemsdk/liquidity-bond` | Position, receipt, allocation, fee ledger |
| Capital allocation | `@totemsdk/omnia-pool` | Deploy, deposit, allocate, NAV, withdraw |
| Channels / factories | `@totemsdk/omnia`, `omnia-factory`, `omnia-splice` | Capacity and settlement backends |
| Scripts and temporal logic | `@totemsdk/kissvm` | Vesting, meters, thresholds, MAST policies |
| Privacy UTXO transfer | `@totemsdk/statechain` | Blind SE co-signed ownership |
| Wallet connect | `@totemsdk/connect` | dApp API, mint/transfer/claim methods |
| Chain reads | `@totemsdk/chain-provider` | Tip, confirmations, epoch anchoring |
| Proofs and manifests | `@totemsdk/proof`, `manifest`, `identity` | Attestations, capabilities, root identity |
| Governance | `@totemsdk/governance` | Votes, delegation, membership |
| Risk and markets | `@totemsdk/eefi` | Capital agreements, quotes, covenants |
| Agent policy | `@totemsdk/agent-policy` | Budgets, grants, usage reservations |
| Email delivery | `@totemsdk/edge-email` | Claim-link transport |

**Rule of thumb:** `omnia-vtxo` holds value; `liquidity-bond` holds the ledger of who owns what; `omnia-pool` decides where capital goes. Do not duplicate the ledger in the VTXO layer.

---

## 14. Reality check: the maturity ladder

This is the section to read before writing a pitch deck.

| Capability | Status | Notes |
|---|---|---|
| Pool creation, mint, transfer, split, merge, refresh | ✅ Now | Core lifecycle is implemented and tested |
| Conservation and proof verification | ✅ Now | `verifyVtxo`, `verifyConservation` |
| Claim policies (`single`, `threshold`, `conditional`, `dvp`, `delegated`, `rotation`, `vesting`, `recovery`, `collateral`) | ✅ Now | `verifyVtxoClaim` requires a caller-supplied signature verifier and rejects future blocks when a chain tip is given |
| Deterministic pool IDs | ✅ Now | `SHA3-256(operator + tokenId + nonce)` |
| Serialization and stores | ✅ Now | BigInt-safe JSON; in-memory store ships; production adapters are roadmap |
| Arbitrary-recipient pooled transfer | 🧩 Designed | V1 uses the owner-state claim coin; `transferVtxo()` alone is an off-chain ledger move |
| Unilateral exit | 🧩 Designed | Owner-pool covenant landed; watchtower and dispute monitoring are roadmap |
| Operator receipts | 🧩 Designed | Concept doc flags mock signatures; 0.9.x adds epoch-anchored receipts — verify against release notes |
| Pool-wide epoch roots | 🧩 Designed | Concept doc flags single-batch local roots as an MVP limitation |
| Enforceable VTXO expiry | ⚠️ Not yet | `expiresAt` is not in the leaf and is dropped on transfer |
| Permissionless bearer cash | ⚠️ Not yet | Explicit non-goal until the V1 exit test passes |
| Watchtower / equivocation detection | ⚠️ Not yet | Operator trust is reduced, not eliminated |
| Public pooled-yield products | ⚠️ Not yet | Requires the exit and watchtower gates |

**What this means for product language:** say "bearer claim with a designed unilateral exit", not "self-custodial cash". Say "product-level expiry", not "the VTXO expires". Say "operator-supported", not "trustless".

---

## 15. Choose your primitive

A decision tree for the next product idea.

```
Is the thing being claimed unique (one of one)?
├─ yes → NFT payload (token supply 1 + metadata + provenance)
└─ no
   ├─ Is it a right to a scarce slot? → ticket / queue payload (NFT-ish VTXO)
   ├─ Is it a permission rather than a balance? → mandate + delegated policy
   ├─ Is it a dataset or credential? → proof / manifest / data payload + on-chain anchor
   ├─ Is it a share of a pool? → liquidity position + receipt
   └─ Is it money?
      ├─ Does it release over time? → vesting policy
      ├─ Does it require a counterparty payment? → dvp policy
      ├─ Does it require an external event? → conditional + oracle
      ├─ Must it be recoverable? → recovery policy
      ├─ Must it be revocable? → delegated + revocation
      └─ Otherwise → single-owner bearer VTXO
```

Then ask the three product questions:

1. **Who can claim?** (bearer, wallet-bound, threshold, delegate)
2. **When does it end?** (deadline, vesting, expiry, rollover)
3. **What happens if nobody claims?** (reclaim, roll forward, burn, donate)

If you cannot answer all three, the product is not specified yet.

---

## 16. What this means for the claim app (the development gap)

The current app is a strong **fungible-value claim rail**. It models a voucher as one fungible token amount:

```ts
Asset { tokenId, symbol, decimals, amountBaseUnits }
```

That is the bottleneck. Everything above is blocked on generalising two types and making the reservation core policy-aware.

### 16.1 The two unions

```ts
type VoucherPayload =
  | { kind: 'native'; amount: string }
  | { kind: 'token'; tokenId: string; amount: string; decimals: number; symbol: string }
  | { kind: 'nft'; tokenId: string; metadata: NftMetadata }
  | { kind: 'basket'; items: VoucherPayload[] }
  | { kind: 'vtxo'; poolId: string; vtxoId: string; tokenId: string; amount: string; claimPolicy: VtxoClaimPolicy }
  | { kind: 'statechain'; chainId: string; coinId: string; tokenId: string; amount: string }
  | { kind: 'liquidity-position'; positionId: string; receiptId: string }
  | { kind: 'proof'; proof: SignedProof }
  | { kind: 'manifest'; manifest: SignedManifest }
  | { kind: 'mandate'; mandate: SignedProof; budget: VoucherPayload }
  | { kind: 'data'; descriptor: DatasetDescriptor; ciphertextRef: string };

type ClaimPolicy =
  | { kind: 'bearer' }
  | { kind: 'script'; address: string; script: string }
  | { kind: 'vesting'; startBlock: number; cliffBlock: number; endBlock: number }
  | { kind: 'threshold'; owners: string[]; threshold: number }
  | { kind: 'htlc'; hashlock: string; timeoutBlock: number }
  | { kind: 'dvp'; paymentId: string; hashlock: string; timeoutBlock: number }
  | { kind: 'delegated'; delegate: string; scope: 'claim' | 'transfer'; expiresAtBlock: number }
  | { kind: 'recovery'; guardians: string[]; threshold: number; recoverAfterBlock: number }
  | { kind: 'revocable'; revoker: string };
```

The reservation and settlement core can stay, but it must become **policy-aware**:

- **Partial claims** for vesting and streaming: reserve a portion, allow repeated claims, track claimed-to-date.
- **Payment-gated claims** for DvP: hold the asset while payment is pending; settle atomically or release.
- **Transfer-gated claims** for statechain/VTXO: prevent double-transfer; verify the claim payload.
- **Budget and usage reservations** for mandates: reserve budget and usage counters.
- **Multi-asset campaigns**: one campaign can issue different payloads per voucher.
- **Collection campaigns**: one NFT per voucher.
- **Delivery modes**: on-chain payout, VTXO transfer, statechain claim payload, proof/manifest delivery, encrypted-data delivery, physical redemption code.
- **Policy-aware expiry and reclaim**: VTXO exit/refund, statechain reclaim, NFT return, mandate revocation, data deletion/rotation.
- **Verification**: ownership proof stays, plus proof/mandate/DvP verification, NFT metadata validation, VTXO/statechain verification.

### 16.2 The recommended first slice

Implement **two payload types** that force the architecture to become policy-aware without destabilising the reservation core:

1. **NFT + DvP** — unique asset, payment-gated. Forces: payload union, policy union, payment-gated reservation, NFT metadata validation, new delivery mode, new expiry semantics.
2. **VTXO + vesting** — time-shaped, partial claims. Forces: partial claims, claimed-to-date accounting, chain-tip awareness, policy-aware reclaim.

Together they exercise nearly every new abstraction: payload union, policy union, partial claims, delivery modes, and policy-aware expiry/reclaim.

### 16.3 The gap, itemised

| Area | Today | Needed | First consumer |
|---|---|---|---|
| Domain type | Single `Asset` | `VoucherPayload` union | NFT, VTXO |
| Policy | Implicit bearer | `ClaimPolicy` union | Vesting, DvP |
| Voucher lifecycle | One-shot `reserved → settled` | Repeatable/partial claims | Vesting |
| Reservation | Amount + wallet | Amount + policy context + usage | Mandate, DvP |
| Settlement | L1 treasury payout | Pluggable delivery modes | VTXO, statechain, proof |
| Expiry | `claimDeadline` + `reclaimAfter` | Policy-aware expiry/reclaim | Vesting, DvP |
| Verification | Wallet ownership proof | Payload + policy + proof verification | NFT, DvP, mandate |
| Campaign model | One asset per campaign | Per-voucher payloads, collections | Multi-asset, NFTs |
| UI | Amount + claim button | Payload-aware claim page (growth ring, DvP checkout, proof viewer) | All |
| Tests | Unit + adversarial + live flow | Policy matrices, partial-claim invariants, DvP races | All |

### 16.4 Definition of done for the first slice

- A campaign can issue an NFT with a DvP ask and a deadline.
- A buyer can claim by paying; the NFT and proof bundle transfer atomically; an unsold item reclaims.
- A campaign can issue a vesting VTXO; a contributor can claim repeatedly; the vested amount floors correctly; the remainder reclaims.
- The reservation core remains the single source of truth for "who owns what, until when".
- No new state is introduced that the reconciliation job cannot explain.
- The readiness report no longer lists expiry and dynamic-exit blockers for the modes we claim to support.

---

## 17. Open problems

An honest guide ends with questions, not certainties.

1. **Enforceable expiry.** How do we bind expiry into the leaf and carry it across transfer without a new covenant per product?
2. **Cross-pool clearing.** Can claims from different pools net against each other without a trusted clearer?
3. **Privacy for bearer links.** Can a claim be proven without revealing the link's provenance to the operator?
4. **Delegation without custody.** How does an agent prove it stayed in scope without handing the owner its entire transcript?
5. **A standard envelope.** Should there be a portable `VtxoEnvelope` schema (payload + policy + proof + transport) so wallets can render any claim?
6. **Wallet UX for partial claims.** What does "you have 3.2 of 10 vested" look like across wallets?
7. **Watchtower incentives.** Who pays, who watches, and what happens when nobody does?
8. **Dispute resolution.** When two proofs conflict, who is the court?
9. **Regulatory expiry.** How do reclaim rules map to escheatment in each jurisdiction?
10. **Reputation from settlement.** Can receipts become a portable, privacy-preserving credit signal?

---

## 18. Glossary

| Term | Meaning |
|---|---|
| **VTXO** | Virtual transaction output: a bearer claim on pooled on-chain capacity |
| **Pool** | The on-chain anchor backing a set of VTXOs |
| **Operator** | The party holding the pool's on-chain UTXO and co-signing mutations |
| **Epoch** | A batch round; refresh re-anchors claims to a new root |
| **Commitment root** | Merkle root over live VTXOs in a pool |
| **Exit** | Returning a claim's value to the chain |
| **Per-share exit** | An exit limited to one holder's committed share |
| **Claim policy** | The rule set deciding who may claim, when, and under what conditions |
| **Payload** | The thing being claimed |
| **DvP** | Delivery versus payment |
| **HTLC** | Hash time-locked contract |
| **MAST** | Merkleised abstract syntax tree of spending conditions |
| **Statechain** | Off-chain UTXO ownership via blind co-signatures |
| **EEFI** | Encrypted executable financial instrument family in the SDK |
| **Mandate** | A scoped, expiring, revocable permission |
| **Manifest** | A signed declaration of an app, capability, or service |

---

## 19. Further reading

Inside the Totem SDK:

- `packages/vtxo/README.md` — lifecycle, API, caveats.
- `packages/vtxo/src/claim-policy.ts` — the authoritative policy union and evaluator.
- `docs/VTXO_OWNERSHIP_AND_TRANSFERABILITY.md` — why arbitrary-recipient transfer is an owner-state covenant, and what `expiresAt` really means.
- `docs/examples/meridian-vtxo-payments.md` — LP capital → VTXO payments → withdrawal, plus the canonical use-case list.
- `docs/VTXO_HARDENING_AND_MULTIPARTY_TEST_PLAN.md` — what "hardened" has to mean.
- `docs/rfc/RFC-038-VTXO-OPERATOR-PROTOCOL.md` — operator protocol.
- `docs/temporal-framework-design.md` — vesting, meters, and time-shaped scripts.
- `docs/building-eefi-with-totem-edge.md` — capital agreements, quotes, covenants.
- `TotemEdgeSDKDocs/docs/concepts/vtxo.md` — the public concept page.

Inside this repository:

- `README.md` — what Vouchar does today and what is gated.
- `SPEC.md` — the service contract.
- `packages/claim-domain/src/types.ts` — the current `Asset` bottleneck.
- `packages/claim-domain/src/state-machine.ts` — the reservation core to generalise.
- `packages/sdk-adapter/src/vtxo.ts` — VTXO modes and the readiness report.

---

*The link is the envelope. The payload can be almost any Minima/Totem asset or right. The claim policy encodes the deal. Build the envelope once.*
