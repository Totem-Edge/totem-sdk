# RFC-065 — Omnia Multipart Payments: Basic MPP and Payment Sets

**Status:** Proposed — implementation not started; basic MPP only
**Priority:** P1 (routing and liquidity)
**Created:** 2026-10-21
**Authors:** Totem SDK Contributors
**Depends on:** RFC-035 (peer coordination), RFC-048 (Omnia primitives), RFC-055 (routing architecture), RFC-064 (off-chain principles)
**Touches:** `omnia-router`, `omnia-host`, `omnia`, durable storage helpers
**Proposes:** A bounded basic-MPP profile. It does not authorise AMP, streaming
payouts or a new package until this RFC is accepted.

---

## 1. Problem

A payer may have enough aggregate liquidity while no single route can carry an
invoice. Splitting one logical payment across several shards can improve success
rate and capital utilisation, but it adds pending reservations, partial-receive
states, replay generations and recovery obligations.

Basic MPP and AMP are not the same feature. Basic MPP uses a shared payment hash.
A malicious receiver can redeem shards separately; it is not an all-or-nothing
guarantee. AMP changes the secret construction to strengthen set-level atomicity.
This RFC implements only the basic profile and states its limits honestly.

---

## 2. Scope

### 2.1 In scope

- One invoice or transfer split into a bounded number of HTLC shards.
- Multiple routes, including paths with different fee and expiry terms.
- Durable payment-set assembly on the receiver.
- Per-shard and aggregate reservation accounting.
- Retry generations, idempotency and reconciliation.
- Failure handling for missing, duplicate, late or replayed shards.

### 2.2 Out of scope

- AMP or any cryptographic all-or-nothing construction.
- Streaming payments where completed units are final.
- Netting or batch settlement.
- Cross-token swaps.
- New transport or relay behaviour beyond existing peer coordination.
- A new package.

---

## 3. Terms

**Payment set:** one logical invoice or transfer executed using multiple HTLCs.

**Shard:** one HTLC attempt with an amount, route, expiry and generation.

**Generation:** a monotonically increasing retry epoch for a payment set. A new
generation must not reuse a previously revealed secret or a settled shard ID.

**Assembly policy:** the receiver's rule for deciding when a payment set is
complete. Shared hash equality alone is not an assembly policy.

---

## 4. Wire and state contract

The implementation should first check whether an existing versioned envelope can
carry these fields. If not, the following illustrative shape defines the minimum:

```ts
type AmountAtoms = string; // canonical unsigned decimal integer
type BlockHeight = string; // canonical unsigned decimal integer
type DigestHex = string;

interface PaymentSet {
  protocol: "omnia.paymentset";
  version: 1;
  paymentSetId: string;
  invoiceId: string;
  semantics: "basic-mpp";
  asset: { chainId: string; tokenId: string; scale: number };
  payerIds: string[];
  recipientId: string;
  paymentHash: DigestHex;
  intendedAmount: AmountAtoms;
  maximumFees: AmountAtoms;
  shardLimit: number;
  generation: number;
  assemblyDeadline: BlockHeight;
  retryPolicy: { maxAttempts: number; maxLifetimeBlocks: number };
}

interface ShardAttempt {
  paymentSetId: string;
  generation: number;
  shardId: string;
  amount: AmountAtoms;
  routeId: string;
  expiresAtBlock: BlockHeight;
  htlcId: string;
}
```

Canonical serialisation, hash domains, integer encoding and duplicate-field
behaviour MUST be pinned before any signed interoperability test. A shard MUST be
bound to exactly one payment set and generation.

---

## 5. Invariants

1. The sum of accepted shard amounts MUST NOT exceed the intended amount unless
   the assembly policy explicitly permits overpayment and the payer authorised it.
2. The sum of outstanding reservations across overlapping routes MUST NOT exceed
   each shared channel's available capacity.
3. A shard MUST NOT settle twice, including across retries, reconnects or restored
   backups.
4. A new generation MUST NOT reuse a revealed secret, a settled shard identity or
   a consumed HTLC.
5. A receiver MUST NOT acknowledge assembly as complete before the policy's
   required shards are durably recorded.
6. A failed API response MUST NOT erase already settled value.
7. An unknown outcome MUST be reconciled before a new debit is attempted.

---

## 6. Protocol

### 6.1 Prepare and reserve

1. Validate asset, recipient, total, fee budget, shard limit and deadlines.
2. Read live channel state and route candidates.
3. Reserve capital per shard, including downstream fees and shared bottlenecks.
4. Persist the payment-set plan, generation and reservation IDs before sending
   the first shard.

### 6.2 Route and split

- Capacity checks MUST include the actual forwarded amount and downstream fees.
- Splitting SHOULD prefer disjoint routes, then minimal overlap.
- The implementation MUST cap shard count, total reserved capital, signing work
  and retry lifetime.
- A route failure SHOULD not invalidate an already accepted shard.

### 6.3 Receive and assemble

The receiver MUST:

1. verify the shard belongs to the set and generation;
2. verify amount, asset, hash, route and expiry;
3. durably record the shard before exposing the secret or acknowledging receipt;
4. apply the declared assembly policy;
5. settle only when the policy is satisfied;
6. preserve partial shards for timeout/refund handling.

A receiver MAY use a policy such as "all shards in the set" or "at least the
intended total with at most N shards". The chosen policy MUST be advertised in the
invoice or payment-set metadata. It MUST be enforced before settlement.

### 6.4 Complete, fail or recover

| Outcome | Required behaviour |
|---|---|
| Complete | Record all settled shards, release unused reservations, reconcile fees |
| Incomplete before deadline | Hold received shards until expiry policy resolves; do not silently keep value |
| Shard expired | Release only after chain-safe HTLC timeout, not wall-clock time |
| Duplicate shard | Reject or idempotently ignore; never settle twice |
| Crash after secret release | Reconcile HTLC state and settled segments before retry |
| Unknown route outcome | Query/reconcile before issuing a new generation |

---

## 7. State machine

```text
prepared
  -> reserved
  -> shards-in-flight
  -> partially-received
  -> settled
  -> reconciled

partially-received
  -> recovering
  -> settled | aborted

shards-in-flight
  -> recovering
  -> settled | aborted

any -> indeterminate
indeterminate -> recovering -> settled | aborted
```

`settled` means the receiver's assembly policy was met and the corresponding
off-chain claims were durably recorded. It does not mean on-chain confirmation
unless a profile explicitly requires it.

---

## 8. Failure and adversarial cases

Tests MUST cover:

- a 100-unit invoice over disjoint 40/35/25 paths;
- overlapping bottlenecks that cannot all be reserved;
- duplicate shards and duplicate generation IDs;
- conflicting totals or shard amounts;
- a missing final shard;
- a shard that settles after the assembly deadline;
- a crash after secret release and before acknowledgement;
- a restored backup with stale settled-segment state;
- replay of an old generation;
- a malicious receiver that redeems only some shards;
- a sender that abandons the set after partial delivery;
- timeout races and chain reorg around expiry.

---

## 9. Evidence and acceptance

### 9.1 Required evidence

- Deterministic accounting tests with exact integer arithmetic.
- A real two-host run, not only in-memory mocks, for at least one multi-shard
  invoice that a single route cannot complete.
- Crash/restart after secret release and after partial settlement.
- Reservation and capacity tests across shared channels.
- A documented receiver assembly policy and its failure semantics.

### 9.2 Promotion gate

Basic MPP may be labelled "implemented" when the required evidence exists. It may
not be described as atomic, all-or-nothing or AMP-compatible. A production label
requires the applicable RFC-063 gates and real-node evidence.

### 9.3 Kill criterion

Stop or redesign if:

- no tested invoice succeeds that a single route could not complete at equal
  capital, or
- reservation/retry complexity causes a material regression on single-route
  payments, or
- the receiver cannot durably assemble shards without risking double settlement.

---

## 10. Metrics

Record, at minimum:

- payment success rate versus single-route baseline at equal capital;
- shard count and distribution;
- p50/p95/p99 completion latency;
- reserved capital and capital-time;
- failed/retried shards and duplicate suppression;
- crash-recovery time;
- memory, persistent writes and network bytes per successful payment.

Thresholds are fixed in the implementation PR after a baseline is measured. A
claim of improvement without an equal-capital baseline is not evidence.

---

## 11. Open questions

1. Should the assembly policy be per invoice, per recipient or per route?
2. What is the maximum shard count that remains safe under WOTS signing limits?
3. How should fees be attributed when shards take different routes?
4. Can the existing durable settled-segment ledger carry pending reservations, or
   is a new durable payment-set store required?
5. What is the minimum useful retry generation policy for edge devices with
   intermittent connectivity?

---

## 12. Non-goals

- AMP secret sharing.
- Cross-token payment sets.
- Netting.
- Probabilistic payments.
- A new routing service.
- Production promotion by documentation alone.
