# RFC-066 — Omnia Atomic Rebalancing: Bounded Cycles

**Status:** Proposed — implementation not started; bounded cycles only
**Priority:** P1 (liquidity)
**Created:** 2026-10-21
**Authors:** Totem SDK Contributors
**Depends on:** RFC-035 (peer coordination), RFC-048 (Omnia primitives), RFC-055 (routing architecture), RFC-064 (off-chain principles)
**Touches:** `omnia-router`, `omnia`, `omnia-host`, durable storage helpers
**Proposes:** A bounded, fully collateralised cycle-rebalancing profile. It does
not authorise general multi-party rebalancing, netting or shared reserves until
this RFC is accepted.

---

## 1. Problem

A participant may hold enough total capital while the wrong channels are depleted.
Closing and reopening channels is slow and expensive. A coordinated cycle can move
liquidity from a surplus channel to a depleted one without treating the movement
as customer revenue.

"Atomic" is the hard word. This RFC distinguishes:

- all-or-nothing off-chain commitment,
- conditional HTLC-loop atomicity,
- and explicitly recoverable partial execution.

The first implementation targets small, fully collateralised cycles where every
participant can verify the same plan and abort safely.

---

## 2. Scope

### 2.1 In scope

- Three-party and small N-party cycles.
- Fully collateralised rebalancing where all participating channels exist.
- A coordinator that proposes but does not control principal.
- Durable reservations across every participating channel.
- Explicit abort, timeout and recovery paths.
- Fee and capital-lock accounting.

### 2.2 Out of scope

- General network-wide optimisation.
- Netting of unrelated obligations.
- Shared overflow reserves (OEX-10).
- Splice-based replenishment (use the existing splice path).
- Cross-asset cycles.
- A new package or mandatory coordination service.
- A production claim before real-node recovery evidence exists.

---

## 3. Atomicity model

A plan is **committed** only when every participating channel has a compatible,
durable state transition and every participant can verify the same plan digest.

A plan is **aborted** only when every reservation is released through its declared
cancellation path. A plan is **recovering** when some reservations or HTLCs remain
and the outcome is not yet known.

The implementation MUST NOT claim rollback after a secret disclosure or broadcast
that has made rollback impossible. It MUST report residual claims explicitly.

### 3.1 Preferred primitive

The first profile SHOULD use a conditional HTLC loop over existing channel
primitives. If a batch primitive is used instead, it MUST provide equivalent
conditional completion or explicit recoverable residuals. A local agent's
permission to rebalance is not proof that all counterparties accepted the same
operation.

---

## 4. Plan contract

Illustrative minimum fields:

```ts
type AmountAtoms = string;
type BlockHeight = string;
type DigestHex = string;

interface RebalancePlan {
  protocol: "omnia.rebalance";
  version: 1;
  planId: string;
  asset: { chainId: string; tokenId: string; scale: number };
  participants: string[];
  channels: Array<{
    channelId: string;
    fundingEpoch: string;
    fromId: string;
    toId: string;
    amount: AmountAtoms;
    fee: AmountAtoms;
  }>;
  planDigest: DigestHex;
  maximumLockUntil: BlockHeight;
  abortAfter: BlockHeight;
  coordinatorId?: string;
  recoveryRefs: string[];
}
```

Every participant MUST verify:

- the same plan digest and participant set;
- asset and channel identities;
- funding epochs and current state;
- per-channel and aggregate capital conservation;
- fees and lock lifetime;
- recovery material and abort conditions.

---

## 5. Invariants

1. Principal is conserved per participant and per asset, except for explicitly
   authorised fees.
2. No participant signs a state that spends reserved capital twice.
3. A stale channel state invalidates or re-plans the operation before further
   commitments.
4. The coordinator cannot move principal, unilaterally settle, or strand funds by
   disappearing.
5. Every accepted reservation has a chain-safe release or recovery path.
6. A participant that withholds its final message cannot obtain an advantage
   outside the declared recovery bound.
7. A rebalance MUST NOT consume capital already reserved by a payment set, virtual
   child, splice, factory close or another rebalance.

---

## 6. Protocol

### 6.1 Discover and propose

1. Select a feasible cycle with sufficient directional capacity.
2. Build a plan with exact channel deltas, fees, epochs and deadlines.
3. Persist the plan before sending it.
4. Send the same immutable plan digest to every participant.

### 6.2 Validate and reserve

Each participant independently:

1. validates the plan against live state;
2. checks aggregate and per-channel capacity;
3. reserves the affected capital and signing budget;
4. persists the reservation and plan digest;
5. returns a signed acceptance or a structured rejection.

A rejection or stale epoch aborts before any irreversible step.

### 6.3 Execute

1. Establish conditional HTLCs or the reviewed batch primitive.
2. Confirm all conditional legs are in place.
3. Reveal secrets / finalise updates in the declared order.
4. Record each settled channel transition durably.
5. Reconcile fees and release unused reservations.

### 6.4 Abort and recover

- Timeout or reject before irreversible steps: release reservations through the
  cancellation path.
- Partial disclosure: enter `recovering`; do not issue a new plan with the same
  capital.
- Stale state after a splice or close: invalidate the plan and require a fresh
  proposal.
- Unknown outcome: reconcile before retrying.

---

## 7. State machine

```text
proposed
  -> validated
  -> reserved
  -> conditional-legs
  -> committed
  -> reconciled

validated | reserved | conditional-legs
  -> aborting
  -> aborted

conditional-legs | committing
  -> recovering
  -> committed | aborted
```

`committed` means every participating channel has the declared compatible state.
It does not mean base-chain confirmation unless the profile explicitly requires it.

---

## 8. Failure and adversarial cases

Tests MUST cover:

- conflicting concurrent cycles over the same channels;
- a peer withholding its final message;
- lost acknowledgements and duplicate delivery;
- coordinator disappearance;
- a stale channel state or changed funding epoch;
- a splice or factory close racing the rebalance;
- partial secret disclosure;
- crash before and after the first secret reveal;
- restored backup with stale reservations;
- reorg around a conditional timeout;
- a participant attempting to reuse reserved capital in another operation.

---

## 9. Evidence and acceptance

### 9.1 Required evidence

- Three independent processes/keys, not one process with simulated peers.
- A small cycle that restores a depleted channel's directional capacity.
- A non-cooperative participant test showing bounded recovery.
- Crash/restart and stale-backup tests.
- Exact capital and fee accounting.
- Comparison with splice-based replenishment under equal starting capital.

### 9.2 Promotion gate

The profile may be called "implemented" only after real-node recovery evidence.
It may not be called "atomic" unless the tested failure model actually provides
all-or-nothing commitment; otherwise it is "recoverable coordinated rebalancing".

Production labelling requires RFC-063 gates.

### 9.3 Kill criterion

Stop or redesign if:

- the coordinator can gain control of principal or strand funds indefinitely;
- the cost or capital lock time is not better than splice-based replenishment;
- conflicting cycles cannot be made safe with bounded reservations;
- recovery depends on a wall-clock timeout that a peer can exploit.

---

## 10. Metrics

- directional capacity restored per plan;
- success rate under concurrent plans;
- capital locked and capital-time;
- fees versus splice baseline;
- p50/p95/p99 completion and recovery latency;
- number of plans aborted/recovered;
- residual claims after a failed plan.

---

## 11. Open questions

1. Is a three-party cycle sufficient for the first product, or is a four-party
   cycle required?
2. Which conditional primitive is safest on the current VM: HTLC loop, batch
   update, or a staged commit?
3. How should fees be split when the cycle crosses channels with different fee
   policies?
4. What is the maximum plan lifetime that remains safe under the chain's inclusion
   assumptions?
5. How does a concurrent splice invalidate a plan without creating a window where
   capital is double-reserved?

---

## 12. Non-goals

- Netting.
- Shared reserves.
- General multi-party optimisation.
- Cross-asset rebalancing.
- A new coordinator service.
- A production claim by documentation alone.
