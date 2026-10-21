# RFC-067 — Omnia Hash-Chain Streams: Prefunded Voucher Prototype

**Status:** Proposed — feasibility prototype only; production path not authorised
**Priority:** P2 (research prototype)
**Created:** 2026-10-21
**Authors:** Totem SDK Contributors
**Depends on:** RFC-039 (custody conformance), RFC-048 (Omnia primitives), RFC-064 (off-chain principles), RFC-063 (production gates)
**Touches:** `omnia`, `kissvm`, `wots-lease`, `omnia-host`, durable storage
**Proposes:** A bounded prototype. It does not authorise pooled funds, a new
package or a production stream product until the feasibility gate in §2 passes.

---

## 1. Problem

A sensor, relay or inference worker may earn thousands of very small increments
from one counterparty. A full signed channel update per increment can make WOTS
generation, verification, transport and slot management dominate the useful work.
A prefunded hash-chain voucher can reduce the fast-path cost while retaining
settlement checkpoints and a unilateral claim.

The technique is simple to describe and difficult to enforce. A voucher is only
useful if the recipient can redeem an acknowledged increment without the payer,
and if a checkpoint and a later voucher cannot credit the same increment twice.

---

## 2. Preconditions

This RFC MUST NOT proceed to integration with real funds unless all of the
following are demonstrated:

1. A constrained claim/output can be expressed in KISSVM and executed on a real
   node.
2. The claim pays the cumulative amount for the last acknowledged voucher.
3. The claim prevents checkpoint/redemption double credit.
4. The payer cannot reclaim committed increments before the refund condition.
5. Worst-case redemption fits a measured VM instruction, script-size and
   state-port budget.
6. The recipient possesses the actual recovery material, not only a root digest.

If any precondition fails, stop. A paper design or an off-chain verifier is not a
substitute.

---

## 3. Scope

### 3.1 In scope

- A single payer and a single recipient per stream.
- A prefunded maximum budget, denominated in one asset.
- Short funded epochs with an explicit maximum number of increments.
- Sequential hash-chain vouchers and cumulative redemption.
- Cooperative checkpoints into ordinary channel balances.
- Unilateral redemption of the latest acknowledged voucher.
- Refund of unused backing after the claim and refund conditions.

### 3.2 Out of scope

- Pooled capital or multiple recipients sharing one backing.
- Merkle-voucher or probabilistic variants beyond a feasibility comparison.
- General-purpose streaming money.
- Cross-asset streams.
- A new package.
- Production promotion before RFC-063 gates and real-node evidence.

---

## 4. Design

### 4.1 Stream authorisation

The payer authorises a stream binding:

- protocol version and network/genesis identity;
- asset identity and exact base-unit scale;
- stream ID and epoch;
- recipient identity;
- hash scheme and root;
- unit amount, maximum steps and total budget;
- claim deadline and refund deadline;
- recovery commitment;
- payer and recipient signatures.

The voucher root is authenticated once. Vouchers do not each require a WOTS
signature. Checkpoints and final settlement do.

### 4.2 Voucher chain

For root `z0` and vouchers `z1 … zn`, the recipient verifies:

```text
H(zi) = z(i-1)
```

A voucher contains the stream ID, epoch, cumulative index `i` and token `zi`.
For denomination `q` and last redeemed index `j`, a later claim at `i` pays
`(i - j) × q`, bounded by the funded budget.

The recipient MUST durably record a voucher before delivering the next agreed
work increment.

### 4.3 Prefunding and claim

The maximum liability MUST be isolated in an enforceable allocation. A record in
the payer's database is not prefunding. The claim path MUST:

- verify the stream authorisation and epoch;
- verify the chain from the root to the claimed index;
- pay only the incremental amount since the last checkpoint;
- reject a claim after the refund condition;
- prevent a second claim for the same increment;
- return unused backing only through the declared refund path.

### 4.4 Checkpoints

Cooperative checkpoints transfer the cumulative earned amount into ordinary
channel balances and retire the corresponding voucher range. Retirement MUST be
durable before the checkpoint is acknowledged. A later voucher claim MUST NOT be
able to credit an already checkpointed increment.

### 4.5 Verification cost

Directly verifying token `i` from the root requires `O(i)` hashes. The prototype
MUST:

- use short epochs (for example 256 or 1,024 increments) selected from a measured
  budget;
- publish the worst-case verification cost;
- compare hash-chain checkpoints with a Merkle-voucher alternative;
- reject an epoch length that cannot be redeemed within the VM budget.

A design that only works when the recipient stays online until a cooperative
checkpoint is not a unilateral claim.

---

## 5. Lifecycle

```text
prepared
  -> funded
  -> streaming
  -> checkpointed
  -> closed

funded | streaming
  -> claiming
  -> claimed | recovering

funded | streaming
  -> refunding
  -> refunded
```

Required states:

- **prepared:** authorisation and recovery material constructed;
- **funded:** backing is enforceable and visible;
- **streaming:** vouchers are issued and durably accepted;
- **checkpointed:** earned amount moved to ordinary balances;
- **claiming:** recipient redeems the latest voucher;
- **refunding:** payer recovers unused backing after claim/refund conditions;
- **recovering:** state is uncertain and signing stops until reconciled.

---

## 6. Invariants

1. The sum of all claims and checkpoints MUST NOT exceed the funded budget.
2. A voucher increment MUST NOT be credited by both a checkpoint and a redemption.
3. A voucher from one stream or epoch MUST NOT be valid in another.
4. A stale or forked epoch MUST be rejected.
5. A recipient MUST NOT acknowledge work before durably accepting the voucher.
6. A payer MUST NOT reclaim an increment already acknowledged to the recipient.
7. A restored backup with a stale voucher watermark MUST stop issuing vouchers.
8. The claim MUST verify the exact token and index, not only a stored balance.

---

## 7. Failure and adversarial cases

Tests MUST cover:

- token replay and index skips;
- forked epochs and root reuse across streams;
- duplicate checkpoints;
- a checkpoint racing a voucher redemption;
- partial redemption;
- payer refusal to checkpoint;
- recipient going offline and later claiming;
- payer attempting to refund before the claim deadline;
- crash before and after voucher acknowledgement;
- restored backup with stale exposure state;
- short-epoch and worst-case verification budgets;
- a malicious recipient presenting a skipped index;
- a malicious payer presenting a different root for the same stream ID.

---

## 8. Evidence and acceptance

### 8.1 Prototype gate

The prototype may proceed only after:

- a real KISSVM claim executes on a real node;
- the latest acknowledged voucher pays the correct incremental amount after payer
  disappearance;
- no checkpoint/redemption double credit is possible in the tested model;
- a measured VM/script/state-port budget is published;
- the recipient's recovery material is sufficient without the payer.

### 8.2 Promotion gate

Production or pooled-fund use requires RFC-039/RFC-058 custody review and RFC-063
gates. A successful unit test or a simulated claim is not sufficient.

### 8.3 Kill criterion

Stop if:

- the constrained claim cannot be expressed safely in the current VM;
- useful epoch lengths exceed the redemption budget;
- checkpoint and redemption double credit cannot be prevented;
- the design requires the recipient to trust the payer's availability;
- the measured cost is not materially better than signed channel updates after
  setup, checkpoint and recovery costs are included.

---

## 9. Metrics

Compare against ordinary signed channel updates:

- WOTS signatures generated/verified per increment;
- setup, checkpoint and redemption cost;
- worst-case VM instructions and script size;
- bytes per voucher and per checkpoint;
- p50/p95/p99 settlement and recovery latency;
- capital locked and capital-time;
- double-credit and replay test coverage;
- edge-hardware CPU, memory and persistent writes.

A claim of "cheaper" MUST include total lifecycle cost, not only fast-path
verification.

---

## 10. Open questions

1. What epoch length is both useful and redeemable within the VM budget?
2. Is a hash chain or a Merkle voucher the better fit for the first prototype?
3. How should checkpoint retirement be represented so a later claim cannot reuse
   the same range?
4. What is the minimum recovery material the recipient must store?
5. How does a stream interact with a channel splice or factory close?

---

## 11. Non-goals

- A production stream product.
- Pooled or shared backing.
- Probabilistic rewards.
- A new package.
- Replacing ordinary signed channel updates.
