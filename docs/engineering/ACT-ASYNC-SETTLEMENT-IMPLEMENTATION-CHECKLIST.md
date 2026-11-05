# SDK General Act Correction — Async Dispatch, Settlement and Actual-Usage Accounting

**Status:** Draft implementation plan, not applied to the repository  
**Created:** 2026-11-05 · **Updated:** 2026-11-05 after settlement-ledger review  
**Formal change record:** [RFC-022 Amendment A — Governed Async Settlement and Actual-Usage Accounting](../rfc/RFC-022-AMENDMENT-A-GOVERNED-ASYNC-SETTLEMENT-AND-ACTUAL-USAGE.md)  
**Relevant:** RFC-010/011/022; blocks agent-triggered training in RFC-077.  
**Packages:** `agent-policy`, `edge`, `act-core`, `act-mavlink`, `act-ocpp`.

## Defect and scope

`AgentEdgeRuntime.executeAction` currently assumes `ok:true` means a completed act and `ok:false` means it never executed. But `act-core` returns `ok:true, outcome:'accepted'` for asynchronous operations and `ok:false, errorCode:'OPERATION_PENDING'` on deduplicated pending operations. `classifyFailure` handles throws, not returned failures. The affected async actions are already in production-shaped `act-mavlink` mission definitions and `act-ocpp` session definitions.

**There is a separate accounting defect:** `ReservationSettlementOutcome` is presently `'completed' | 'definitely-not-executed'`. The run-state and grant-usage stores cannot settle a job that started, consumed 40% of its reserved resources, and then failed. Simply re-snapshotting `RunStepReceipt.effects` does not update the mandate usage rows. `GrantUsageStore.commit` commits the reserved delta; a terminal event after TTL rejects commit and leaves the reservation `unknown`.

This is a **general Act correctness release**, not QVAC-specific. Existing synchronous behaviour may be preserved; existing erroneous asynchronous behaviour must change.

## P0 API decisions

1. `EdgeActionDefinition.execute` returns an explicit trusted lifecycle result with `dispatchState: not-dispatched | dispatched | unknown`, `terminalOutcome: confirmed | failed | cancelled | aborted | unknown` when terminal, nonterminal phase (`accepted | running | cancelling | reconciling`), and operation identity. Dispatch, terminality and accounting are separate facts. `EdgeActionResult` surfaces `operationId`, `reservationId`, lifecycle disposition, and the accounting receipt/ref.
2. `classifyFailure` handles returned failures **and** exceptions. It cannot convert accepted/running/unknown dispatch evidence into proven non-execution. The special `OPERATION_PENDING` path is nonterminal and holds the **existing** reservation; no new nonce or operation dispatch.
3. Introduce `ActualConsumptionV1` for trusted metered effects, per-mandate usage, measured resource quantities, measurement status and evidence refs. Validate canonical quantities and `actual <= reserved`; unknown metering is not zero.
4. Introduce **`settleActual`** (or equivalently named canonical settlement operation) across `GrantBoundAutonomyPolicy`, `RunStateStore`, `GrantUsageStore` and their durable/in-memory implementations. Atomically transform reserved totals into actual committed usage and release only the difference. `committedSteps`/mandate count records an executed attempt even if it fails or is cancelled; success is a separate outcome.
5. The shared SQLite authority MUST transactionally update run totals **and** `autonomy_mandate_usage` amounts/counts. A cross-backend configuration needs a durable settlement intent plus idempotent recovery. Replaying the same settlement digest is a no-op; conflicting settlements reject.
6. Preserve compatibility methods for legacy synchronous cases, but **do not call `commit()` on expired reservations**. A trusted coordinator renews within a bounded absolute lease; expired work enters unknown/held recovery and terminal evidence is settled via `reconcileReservation`/`settleActual`, even if the operation has finished.
7. Bind prepared command digest, authorized effects, reservation ID and operation ID before dispatch. Existing `CanonicalAgentAction` hashing and reservation `actionDigest` (currently nonce-based) must not be confused with prepared-command binding.

## Deterministic settlement table

| Dispatch | Terminal outcome or phase | Reservation | Ledger |
|---|---|---|---|
| Not dispatched | Failed/aborted | Release | Actual zero, when non-dispatch proven |
| Not dispatched | Cancelled before dispatch | Release | Actual zero, evidence recorded |
| Dispatched | Accepted/running/cancelling | HOLD | Nothing committed, all outstanding capacity counted |
| Dispatched | Confirmed | Settle | Verified actual; or explicit approved full-ceiling policy |
| Dispatched | Failed after execution | Settle actual | Charge used amount/count; release unconsumed remainder; preserve failure |
| Dispatched | Cancelled after execution | Settle actual | Charge used amount/count; release unconsumed remainder; preserve cancellation |
| Unknown | Anything | HOLD | Do not infer from `ok`, timeout or missing logs |
| Original operation already pending | `OPERATION_PENDING` | HOLD original | No second reservation/dispatch |

Example ledger assertion: reserve `1000` accelerator seconds; worker demonstrably consumes `400` and fails. Persist `committed=400`, `held=0`, `released=600`, `available=600`, executed attempt count `1`, `terminalOutcome='failed'`. On crash/replay, those numbers and the settlement digest must be unchanged.

If actual usage is unverifiable, do **not** free the remainder: remain held for reconciliation or use a previously approved, conservative full-reservation charge. A failed executed operation can never be treated as `definitely-not-executed`.

## Lease state and crash recovery

- Initial TTL is currently 60 seconds. Define operation-specific lease, renew-before interval, absolute deadline, signed/authorized lease owner, generation/fencing and bounded renewal rules. Heartbeat is liveness evidence, not proof of completion.
- Cancellation: `accepted -> running -> cancelling -> cancelled | confirmed | failed | unknown`. Only qualified terminal evidence closes the operation; a cancellation request alone does not.
- Expired unsettled reservations become unknown with full budget held. Terminal settlement after expiry follows explicit reconciliation, **never a normal `commit` call**.
- Long-tail unknown remains held after the finite recovery deadline and requires operator action; never auto-release. `act-core`'s treatment of `unknown` as terminal must not make a held reservation impossible to reconcile.
- Durable operation record, authenticated worker job status, output artifact, provider job handle, process status and logs may all inform reconciliation, but process exit/log absence does not prove no dispatch.
- Retries that cannot prove non-dispatch require provider-supported idempotent operation IDs and must never create a second operation by using a fresh run/nonce.

## Regression matrix — assert ledgers and receipts

All tests assert **returned lifecycle**, reservation status, held/committed/released budget, grant/mandate ledger, run totals, persisted actual-consumption receipt and replay idempotence; use fake clock and actual durable restart tests.

| Test group | Cases |
|---|---|
| Synchronous compatibility | Legacy `ok:true` commits; legacy `ok:false` proven no-dispatch aborts |
| Basic async | confirmed commits; accepted holds; running holds; unknown holds; pending dedup holds |
| Returned/throw failures | `ok:false` not-dispatched releases; executed failure settles 40%; returned unknown holds; throw-classified unknown holds |
| Cancellation | Proved before dispatch releases; after dispatch settles actual; unacknowledged request holds |
| Lease / restart | 60-second expiry forces unknown; post-expiry terminal event via reconcile not commit; renewal/absolute deadline; crash after reserve; crash after dispatch |
| Ledger integrity | Per-mandate and per-run totals agree; 1000/400/600 vector; double settle no-op; conflicting settle rejected; over-reserved actual rejected; missing meter never charged zero |
| MAVLink | `flight:startMission`, `flight:hold`, `flight:returnToLaunch`, `flight:land` hold on accepted and later reconcile |
| OCPP | `charging:startSession`, `charging:stopSession` hold on accepted and later reconcile |
| Security | Tampered command digest, fake meter evidence, lease/signature exhaustion, duplicate replay fail closed |

## Delivery and publication

1. **Clean worktree and baseline pin.** Keep this correction independent of concurrent feature changes. Formal amendment first, plus explicit SDK issue/PR link.
2. **`agent-policy`** first: actual settlement contracts, atomic SQLite and in-memory ledger correctness, renewed/expired reservation handling and golden tests. Cover both `RunStateStore` and `GrantUsageStore`.
3. **`edge`** next: widened results, explicit dispatch/terminal classification, nonterminal hold, trusted operation/reservation correlation. Preserve legacy sync semantics; update and test the simple-policy bypass separately where relevant.
4. **`act-core`** next: report precise dispatch/terminal evidence, reconcile actual usage, adapt operation state and terminal classification. Reuse existing `OperationStore` rather than inventing another ledger.
5. **`act-mavlink` / `act-ocpp`** next: qualification regressions, no premature commit, no duplicate dispatch, public migration guidance. Update other async adapters if the inspection reveals any.
6. Publish in dependency order: **agent-policy -> edge -> act-core -> act-mavlink/act-ocpp** (confirm exact graph on pinned baseline). `check-upstream-published` WILL block a downstream release requiring unpublished upstream workspace versions. Respect the guard; publish prerequisites first.
7. Update RFC-010/011/022 references and RFC index, package API docs, public semantics for nonterminal `ok:false`, qualification registry and release notes; run established metadata, workspace and package gate checks.

**Exit:** Both in-memory and SQLite ledgers accurately settle a known executed failure with partial actual use; accepted/unknown always hold; post-TTL recovery is correct; and all six existing MAVLink/OCPP async actions pass end-to-end reconciliation without regressions to synchronous behaviour.

**No implementation or GitHub publication is claimed by these draft documents.**
