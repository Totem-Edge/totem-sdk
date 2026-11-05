# RFC-022 Amendment A — Governed Asynchronous Settlement and Actual-Usage Accounting

Status: Draft for implementation review — not implemented; release-blocking correctness correction
Created: 2026-11-05
Amends: RFC-022 (prepared-command binding and async lifecycle)
Cross-references: RFC-010, RFC-011, RFC-019, RFC-023, RFC-024, RFC-025, and proposed RFC-077
Affected: @totemsdk/edge, @totemsdk/agent-policy, @totemsdk/act-core; regression consumers @totemsdk/act-mavlink, @totemsdk/act-ocpp
Baseline: source inspected on Totem-Edge/totem-sdk default branch, 2026-11-05, around commit 37e1b652. Pin an exact implementation commit and inspect concurrent changes before coding.
Relationship to RFC-077: this amendment must land independently before RFC-077 allows agent-reachable training. It is an existing-act correctness fix, not a QVAC feature.

## 1. Normative decision

The governed runtime MUST settle authorization by verified dispatch state, verified terminal outcome, and actual chargeable consumption, not by result.ok alone. An accepted operation is not a completed operation; a failed operation that actually ran is not a never-executed operation. Uncertain execution retains its reservation until qualified reconciliation.

The amendment preserves existing synchronous actions whose results have no explicit lifecycle metadata, but deliberately changes the incorrect async settlement behaviour in AgentEdgeRuntime and affected industrial adapters.

## 2. Confirmed defects and constraints

- `packages/edge/src/agent-runtime.ts`: `ok:true` causes `policy.commit`, `ok:false` causes `policy.abort`, and `classifyFailure` only handles thrown failures. `EdgeActionResult` lacks operation/reservation lifecycle fields.
- `packages/act-core/src/edge-adapter.ts`: `runWithPolicy` returns `ok:true, outcome:'accepted'` for `async.confirmation:'accepted'`, while durable `OPERATION_PENDING` returns `ok:false`; neither boolean encodes settlement correctness.
- Accepted async definitions are already used by `act-mavlink` (`flight:startMission`, `flight:hold`, `flight:returnToLaunch`, `flight:land`) and `act-ocpp` (`charging:startSession`, `charging:stopSession`).
- `packages/agent-policy/src/run-state-store.ts`: `ReservationSettlementOutcome` is only `'completed' | 'definitely-not-executed'`. `RunStepReceipt.effects` can be folded into run totals, but no explicit reserved versus actual accounting contract exists.
- `packages/agent-policy/src/grant-usage.ts`: `commit` marks reserved usage committed without reducing it to measured usage; `reconcileReservation` cannot express executed failure with partial charges. Its `commit` fails after reservation expiry and marks the reservation unknown.
- `packages/agent-policy/src/sqlite-run-state-store.ts` co-locates run and mandate rows in one transactional SQLite authority. New settlement MUST update both within the same transaction, rather than changing the receipt alone. The in-memory run and grant stores require equivalent semantics.
- `GrantBoundAutonomyPolicy` uses a 60-second default reservation TTL; an expired unsettled reservation is unknown with budget held. A long-lived job needs renewal, recovery and an explicit reconciliation route; `commit()` after expiration is incorrect.

## 3. Canonical execution evidence and state model

Proposed types; specific names and code locations are subject to API review. Their semantics are required.

```ts
type DispatchState = 'not-dispatched' | 'dispatched' | 'unknown';
type TerminalOutcome = 'confirmed' | 'failed' | 'cancelled' | 'aborted' | 'unknown';
type NonterminalPhase = 'accepted' | 'running' | 'cancelling' | 'reconciling';

interface ActualConsumptionV1 {
  schema: 'totem:act:actual-consumption/v1';
  // Bounded, normalized usage observed by trusted, authenticated meter(s).
  spends: readonly { tokenId: string; amount: string; recipient?: string }[];
  fees?: readonly { tokenId: string; amount: string }[];
  compute?: readonly {
    resourceId: string;
    wallSeconds?: string;
    cpuSeconds?: string;
    acceleratorSeconds?: string;
    acceleratorClass?: string;
    peakMemoryBytes?: string;
    bytesWritten?: string;
  }[];
  // Explicitly measured per mandate; count is normally one once dispatched.
  mandateUsage: readonly { mandateId: string; count: number; amount?: string }[];
  evidenceRefs: readonly string[];
  measuredAt: number;
  measurementStatus: 'verified' | 'partial' | 'unavailable';
}

interface GovernedExecutionEvidence {
  dispatchState: DispatchState;
  phase?: NonterminalPhase;
  terminalOutcome?: TerminalOutcome;
  operationId: string;
  preparedCommandDigest: string;
  actual?: ActualConsumptionV1;
  terminalEvidenceRefs?: readonly string[];
}
```

`dispatchState` and terminality are orthogonal. `phase` is mutually exclusive with a known terminal outcome. An uncertain result must not be expressed as a confirmed terminal failure solely because a transport returned an error.

`actual` is an accounting claim, not a raw callback payload. All values require a unit, bounded canonical representation and authenticated evidence. Reject negative, non-finite, overprecision, duplicate resource, and incompatible unit entries. The canonical digest binds every accounting field, source identity and its evidence references.

`actual` MUST be less than or equal to the originally reserved maximum in every dimension. If actual usage exceeds a bound, record and escalate the violation; never silently rewrite the approved reservation or accept an over-budget commit.

A proven zero can be zero; an unknown measurement MUST NOT be interpreted as zero. An unmetered executed outcome keeps disputed capacity held until resolved, or is conservatively charged the approved maximum under an explicit, preauthorized accounting policy; never silently release it.

Actual consumption records are not required for non-dispatched releases. `unknown` dispatch status always holds, regardless of reported `ok` or an untrusted terminal string.

Legacy synchronous `EdgeActionDefinition.execute` without lifecycle metadata retains its existing `ok:true -> commit`, `ok:false -> abort` policy only for definitions declared synchronous and without ambiguity. An explicitly asynchronous definition MUST provide structured lifecycle evidence and fail closed on missing fields.

### 3.1 Dispatch × outcome × ledger disposition

| Dispatch evidence | Outcome / phase | Ledger disposition | Caller-facing status |
|---|---|---|---|
| not-dispatched | failed/aborted | Release entire reserved usage | Terminal failure |
| not-dispatched | cancelled before dispatch | Release entire reserved usage | Terminal cancellation |
| dispatched | accepted / running | HOLD full remainder; no commit | Nonterminal, operation ID returned |
| dispatched | cancelling / reconciliation pending | HOLD full remainder; no commit | Nonterminal / cancellation requested |
| dispatched | confirmed | Settle actual usage when meter exists; otherwise explicit reserved-maximum accounting policy | Terminal success |
| dispatched | failed | Commit verified actual usage, release unused capacity, record terminal failure | Terminal failure with consumption |
| dispatched | cancelled after dispatch | Commit verified actual usage, release unused capacity, record terminal cancellation | Terminal cancellation with consumption |
| unknown | any outcome, including claimed success | HOLD; require reconciliation | EXECUTION_UNCERTAIN |
| Any, original operation existing | OPERATION_PENDING | HOLD original reservation; no second reservation | Pending / deduplicated |
| Any | throw, classifier returns unknown | HOLD | EXECUTION_UNCERTAIN |

`classifyFailure` SHALL be used for returned failures as well as thrown exceptions, and may only classify definitely-not-executed when the claim is independently supported. It MUST NOT override existing accepted/running/dispatch evidence. Error-code mappings are not proof of non-dispatch.

### 3.2 Returned API

`EdgeActionDefinition.execute` SHALL return a widened, typed execution result carrying `dispatchState`, terminal outcome or nonterminal phase, and `operationId`; where metered, it also carries verified actual evidence. It MAY accept a runtime-provided, trusted execution context with reservation identity and prepared-command digest; the context is not an agent-supplied payload. `EdgeActionResult` SHALL expose `dispatchState`, `phase` / `terminalOutcome`, `reservationId`, `operationId`, and the accounting receipt or its immutable reference. Avoid overloading `ok` as an outcome.

## 4. Actual settlement — the missing accounting primitive

Introduce one canonical settlement operation, with distinct names permitted for direct grant-usage versus governed run APIs, and retain existing `commit`/`abort` as compatibility wrappers for strictly supported legacy synchronous cases.

```ts
type SettlementDisposition =
  | 'release-nonexecution'
  | 'commit-reserved'
  | 'settle-actual';

interface SettlementInstructionV1 {
  schema: 'totem:act:settlement/v1';
  reservationId: string;
  operationId: string;
  preparedCommandDigest: string;
  dispatchState: DispatchState;
  terminalOutcome: Exclude<TerminalOutcome, 'unknown'>;
  disposition: SettlementDisposition;
  actual?: ActualConsumptionV1;
  evidenceRefs: readonly string[];
  settlementId: string; // canonical digest of body excluding settlementId
}

// Proposed new canonical methods on the authority layer:
// GrantBoundAutonomyPolicy.settleActual(instruction): Promise<RunStepReceipt>
// RunStateStore.settleReservation(instruction): Promise<RunStepReceipt>
// GrantUsageStore.settleActual(instruction): Promise<StepReceipt>
// Existing reconcileReservation(...) preserved as a legacy compatibility entry.
```

Required invariants:

- `release-nonexecution` requires `not-dispatched` and conclusive non-dispatch/cancel evidence. It decrements reserved exposure, charges zero actual spend/compute, and records an aborted/cancelled terminal outcome as applicable.
- `commit-reserved` is limited to verified confirmation or a declared, preauthorized conservative full-ceiling policy. The full authorized reservation becomes charged; do not treat missing measurements as zero.
- `settle-actual` requires a terminal and authenticated executed outcome plus a valid `ActualConsumptionV1`; the store atomically converts the held reservation to its actual committed count/amount/resource totals and releases only the unconsumed difference. A dispatched failure or cancellation counts as an executed attempt (normally count 1), even when spend/compute is partial.
- A reservation MUST be settled at most once. Identical `settlementId` retries return the same persisted receipt; conflicting settlement claims fail closed and require explicit dispute/review. A durable settlement receipt records reserved maxima, actual charges, released remainder, terminal outcome, dispatch evidence, operation/descriptor digest and evidence refs.
- Run totals and each mandate's grant-usage ledger MUST be updated in the same SQLite transaction where they share the store. In memory, enforce the same state transitions and balance invariants. If different persistence backends are intentionally used, write a durable settlement intent and recover/replay idempotently; do not report settlement complete until both agree. Do not claim cross-store atomicity without a proven transaction or recovery protocol.
- Limit checks MUST include outstanding reservations in addition to committed usage, and must never free held unknown amounts. Provide deterministic `available = capacity - committed - held` assertions per resource/mandate. Do not allow concurrency bypass through crash/restart or partial settlement.
- All receipt effects and `usageDelta` entries used for accounting SHALL come from trusted verified actual measurement (or an explicit full-ceiling policy), not from a caller-updated `effects` object. Merely replacing `RunStepReceipt.effects` without changing mandate usage rows is insufficient.
- Ledger example: reserve a maximum of 1000 accelerator seconds, execute and fail after a meter proves 400 seconds, settle the counted attempt and 400 accelerator seconds, and release 600 seconds of unused capacity. The receipt must preserve the failure. A later caller must see the recovered 600 capacity, not 0 or 1000. This example uses a hypothetical compute quota, not an existing SDK implementation.

## 5. Lease renewal and post-expiry recovery

The current run-level initial TTL is 60 seconds. Define a bounded lease profile per operation with `leaseDurationMs`, `renewBeforeMs`, `absoluteDeadlineAt`, `owner`, `generation`, `maxRenewals` or equivalent absolute max; prove monotonic deadlines and CAS fencing. All values are trusted policy inputs, not inferred from an agent's hints.

A trusted coordinator MAY renew an accepted/`running` reservation before expiry, only while the operation remains within the original grant and maximum resource envelope. Heartbeat and provider progress are separate facts; a heartbeat does not prove task success or expenditure.

A cancellation moves `accepted -> running -> cancelling -> cancelled | confirmed | failed | unknown`. Cancellation becomes terminal only on authoritative evidence. A timeout does not imply cancellation succeeded.

On expiry, record `unknown` and HOLD. Never call `commit()` on an expired reservation. Obtain authenticated terminal evidence and use `reconcileReservation` / `settleActual` from the recovery path, or retain `unknown` pending operator review.

A lease cannot extend the originally approved maximum job duration, cannot manufacture new signing capacity, and cannot renew beyond the finite reconciliation window. After the window, unresolved work is still `unknown` and budget remains held.

Reconciliation requires durable operation ID + provider handle or authenticated evidence. Accepted-state persistence and reservation correlation must precede dispatch; crashes in between are classified without guessing.

Provider checks must distinguish definitely-not-executed from merely absent logs, a terminated process, a missing checkpoint or failed response. None of those by themselves proves nonexecution.

Important status compatibility: `act-core` currently lists `'unknown'` among terminal operation statuses while it also supports reconciling. An unresolved operational state MUST remain reconcilable. Keep `unknown` as an outcome/observation rather than an irreversibly terminal store state, or add a deliberate operator-only recovery route that cannot release budget without evidence.

## 6. Prepared-command and signing binding

Existing `CanonicalAgentAction.effects` are hashed, but the reservation `actionDigest` is currently populated from a nonce. RFC-022's prepared-command hash must be securely bound into the authorized canonical action and persisted operation/reservation. Specify an additive versioned `preparedOperationDigest` / committed state-change field, with immutable derivation from `prepare()`. Do not silently change historical digest interpretation or accept free-form context as authority. All signing uses the existing WOTS lease mechanism; exhaustions fail closed at the appropriate step.

## 7. Required regression matrix — ledger assertions, not just ok

Every fixture MUST assert the operation status, reservation state, committed/held/released budget, per-mandate usage, run totals, immutable actual-consumption receipt, and idempotence. Use fake clock and durable restart capable stores; add coverage for SQLite and in-memory implementations.

| ID | Fixture | Expected settlement |
|---|---|---|
| A01 | Existing synchronous `ok:true` without async metadata | Historical commit behaviour unchanged |
| A02 | Existing synchronous `ok:false`, definitely no dispatch | Historical abort/release unchanged |
| A03 | `ok:true`, dispatched, confirmed | Commit/settle as authorized; terminal success |
| A04 | `ok:true`, dispatched, accepted | Reservation held; no committed usage; operation ID reported |
| A05 | `ok:false`, proven not dispatched | Full release, aborted/failed recorded |
| A06 | `ok:false`, executed then failed with 40% actual | Charge 40%; release 60%; count executed attempt; terminal failed receipt |
| A07 | `ok:false`, dispatch unknown | Hold 100%; not a terminal failure |
| A08 | Throw, classifier unknown | Hold 100%; no second dispatch |
| A09 | Duplicate `OPERATION_PENDING` | Original reservation held, no new nonce/claim |
| A10 | Cancellation before dispatch, proven | Full release; cancelled outcome |
| A11 | Cancellation after dispatch, actual 40% | Charge 40%; release 60%; cancellation receipt |
| A12 | Crash after reserve/before dispatch | Reconcile non-dispatch evidence, never guess |
| A13 | Crash after dispatch/before ACK | Unknown held; later confirmed/failed/actual reconciliation |
| A14 | TTL expires before job ends | Commit rejected; recovered reservation unknown; settle via recovery after authenticated result |
| A15 | Heartbeat renewal | Fenced lease extends within absolute ceiling; hold preserved |
| A16 | Conflicting second settlement | No double ledger mutation; conflict rejected |
| A17 | Unknown actual measurement | Never turn missing data into zero; hold or explicit conservative ceiling |
| A18 | Actual exceeds reserved maxima | Reject/violation recorded; no policy-bypassing ledger update |
| A19 | MAVLink `flight:startMission`, `flight:hold`, `flight:returnToLaunch`, `flight:land` | Accepted holds; reconciling works; original operation not re-dispatched |
| A20 | OCPP `charging:startSession`, `charging:stopSession` | Accepted holds; terminal reconciliation settles once |
| A21 | SQLite restart and in-memory conformance parity | Stable final totals and identical settlement receipt digests |
| A22 | Lease/signing capacity exhausted | Deny pre-dispatch or hold uncertain; never fabricate terminal proof |

Ledger oracle: an initial budget of 1000 units, reservation 1000, actual 400 and terminal executed failure yields `committed=400`, `held=0`, `released=600`, available capacity 600, recorded executed attempt 1, and a failure receipt bound to the original operation. A crash/replay MUST produce exactly the same totals.

## 8. Compatibility and release plan

This is a behavioural correction to a published governed lifecycle, not merely a type widening. Deliver it in a clean worktree with a pinned baseline and migration notes.

1. First implement `agent-policy` actual-settlement contracts, atomic SQLite + memory storage, TTL renewal/recovery, and full ledger tests. Publish compatible additions before downstream consumers require the new version.
2. Update `edge` result/action definitions and `AgentEdgeRuntime` settlement logic with backward-compatible synchronous default and explicit async behavior; test old synchronous definitions and the new classification matrices.
3. Update `act-core` to surface dispatch/terminal/actual evidence and durable operation/reservation correlation; adapt `OperationLifecycle` for reconciled terminal settlement. The source/workspace implementation order may require coordinated branches, but released packages must use published compatible upstream versions.
4. Requalify `act-mavlink` and `act-ocpp` against the new async contract; publish them only after their declared dependencies are available. Both must validate no premature settlement and no accidental duplicate physical dispatch.
5. Run the existing repository's `check-upstream-published` guard, sequential release process, package metadata/export validation, workspace verification, and qualification registry checks. The guard can block downstream publication when prerequisite versions are not yet published: don't bypass it or declare a green release prematurely.
6. Update `docs/rfc/README.md`, RFC-010/011/022 references, Act package READMEs, public API docs, SDK qualification registry and a consumer migration note. Consumers treating `ok:false` as a terminal failure must migrate to explicit phase/`terminalOutcome` and settled ledger receipts.

Important dependency detail: `act-core` already depends on `edge` and `agent-policy`; `edge` depends on `agent-policy`. Actual published dependency order is therefore `agent-policy -> edge -> act-core -> act-mavlink/act-ocpp`, with any additional current dependency edges checked at implementation baseline. Do not change this order just because tests are developed together.

## 9. Exit criteria

- A returned `accepted`, `running`, `reconciling` or `OPERATION_PENDING` never commits or releases authorization by boolean inference.
- A failed/cancelled dispatched job commits actual verified consumption and releases only unused reserved capacity, including correct per-mandate rows, without claiming non-execution.
- A post-TTL terminal event is reconciled through the recovery route; no `commit()` after expiry and no automatic refund on expiry.
- Crash/restart cannot double-dispatch, double-charge or silently free held budget. Reconciliation remains possible for unknown outcomes.
- All 22 scenarios pass with per-ledger assertions on SQLite and in-memory stores, and existing MAVLink/OCPP qualification remains valid under the corrected semantics.
- Documentation and release gates are updated; no claim of implementation before source/tests and actual published versions justify it.

The RFC-077 adaptive-intelligence programme MAY begin its fake trainer/evaluator Slice 0 before native QVAC is available, but its agent-triggered training Act is release-blocked until this amendment passes.
