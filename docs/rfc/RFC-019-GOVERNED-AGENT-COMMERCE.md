# RFC-019: Governed Agent Commerce — close the `createEdge()` privilege-escalation path

**Status:** Draft — remediation contract (P0 + P1 landed; P1-3 idempotency open)
**Created:** 2026-09-28
**Authors:** Totem SDK Contributors
**Depends on:** RFC-004 (Edge SDK v1), RFC-010 (Industrial Action RC), RFC-007 (storage/durability)
**Touches:** `@totemsdk/edge` (`create-edge`, `purchasing/*`, `action-registry`, `actions`, `agent-runtime`, `index`), `@totemsdk/agent-policy` (reservation lifecycle)
**Evidence:** [docs/audits/edge-agent-commerce-privilege-escalation-2026-09.md](../audits/edge-agent-commerce-privilege-escalation-2026-09.md)

---

## 1. Summary

`createAgentEdgeRuntime()` is governed, but the commerce surface is **not on its
path**: there is no governed `purchase:*` action, and `createEdge()` exposes an
alternate ungoverned purchasing API (`buy()`, `negotiate()`, and the raw `buyer`)
that calls a read-only `authority.approve()` then a raw `payment.pay()`.

This RFC makes agent commerce reachable **only** through governed actions and
closes the reservation-lifecycle and canonical-effects gaps. The security
invariant:

> An agent must never be able to cause a purchase, payment, economically binding
> negotiation, signature, resource commitment, or equivalent commerce side effect
> without passing through the same governed authorization/reservation boundary
> used by `createAgentEdgeRuntime()`.

`createEdge()` remains a **trusted-host** primitive; it must not be a supported
agent-facing path around governed execution.

---

## 2. Required architecture

```text
Agent
  ↓
AgentEdgeRuntime.executeAction('purchase:buy' | 'purchase:negotiate')
  ↓
EdgeActionRegistry
  ↓
governed purchase action
  ↓
purchase discovery / negotiation / agreement preparation
  ↓
economic commit barrier
  ↓
build actual payment/resource operation
  ↓
derive canonical effects from the actual operation
  ↓
GrantBoundAutonomyPolicy.authorizeAndReserve(...)
  ↓
execute payment / resource commitment
  ↓
commit on success | abort on definite failure | hold/reconcile on uncertainty
  ↓
governed receipt graph
```

Prefer integrating purchasing into `createAgentEdgeRuntime()` via
`EdgeActionDefinition`s (`purchase:buy`, `purchase:negotiate`) rather than a second
governance framework. A dedicated internal `GovernedCommerceRuntime` callable
**only** from a governed action definition is acceptable if it yields the smallest
trusted computing base and fewest bypass paths.

---

## 3. Critical security requirements

1. **No alternate agent commerce entrance.** The agent must not receive
   `EdgeCommerceRuntime`, `EdgeBuyer`, `buy()`, `negotiate()`, `payment.pay()`, a
   raw signer/authority/commerce port, or any functionally equivalent wrapper that
   bypasses `executeAction()`. Enforce through types/API structure, not comments.
2. **Governance at the economic commit point.** Immediately before any irreversible
   economic action: reload/revalidate durable purchase state; revalidate
   quote/agreement expiry + freshness; revalidate seller/provider/manifest identity;
   build/prepare the **actual operation**; derive canonical effects; call
   `authorizeAndReserve()`; execute exactly the authorized prepared operation;
   commit/abort per the real result.
3. **Authorize canonical effects, not agent claims.** Do not trust agent-supplied
   `amount`/`recipient`/`tokenId`/`fee`/`provider`/`resource`/`channel effects`.
   Build the real transaction first; derive facts from the actual output set
   (change and channel-internal outputs must not count as external spend). Bind the
   executed operation to the authorized one — no TOCTOU rebuild after authorization.
4. **Atomic budget reservation.** Reuse the same policy accounting authority as the
   governed runtime (`policy.authorizeAndReserve(...)` over the shared
   run/grant state). No separate weaker purchasing budget.
5. **Close the reservation lifecycle.** The governed path owns
   `authorize/reserve → execute → commit` (or `→ definite failure → abort`). For
   ambiguous post-dispatch outcomes, **do not auto-release**; use
   `UNKNOWN`/`HELD`/`REQUIRES_RECONCILIATION` until durable evidence proves
   execution. Only `definitely-not-executed` releases a reservation.
6. **Idempotency.** Retries must not double-pay, double-reserve, create multiple
   commitments, or diverge receipts. Stable durable ids tie together `runId`,
   `stepId`, `purchaseId`, `agreementId`, `reservationId`, payment idempotency key,
   and execution receipt. Recovery resumes the same logical operation.
7. **Govern consequential negotiation.** Classify negotiation ops as
   read-only / externally-observable / signed / economically-binding / obligation-
   creating. Provide policy constraints (resource class, counterparties, max
   unit/total price, token/payment method, max rounds, max lifetime, quote
   freshness, max fees, max work, binding acceptance permitted?). A binding signed
   acceptance must itself be governed; if negotiation stays non-binding until the
   commit barrier, document and test that invariant.
8. **Preserve the ungrantable boundary.** Commerce must not become an indirect
   route to seed material, private keys, raw signing, unrestricted signer
   callbacks, WOTS lease management, raw wallet handles, raw payment ports, policy
   replacement, arbitrary tx submission, or unrestricted identity/root ops.
   Signing required internally by an authorized commerce action stays private to
   the trusted runtime.

---

## 4. Suggested implementation shape

```ts
{
  action: 'purchase:buy',
  def: {
    capability: 'purchase:buy',
    effect: 'spend',
    prepare: async (input) => {
      // discovery → negotiation → agreement → freshness/identity checks
      // → prepare the ACTUAL payment/resource operation (immutable)
    },
    deriveEffects: (prepared) => {
      // canonical effects from the prepared real operation
    },
    execute: async (prepared) => {
      // execute exactly the prepared operation (idempotent, reservation-bound)
    },
  },
}
```

Account for multi-stage purchasing: a dedicated internal `GovernedCommerceRuntime`
callable only from a governed action definition, whose final economic commit uses
the same `authorizeAndReserve` lifecycle, is acceptable.

---

## 5. API hardening

- Don't expose `.buyer` from agent-capable runtimes.
- Don't expose raw commerce/payment/authority ports to agents.
- Keep trusted-host commerce APIs separate from agent-facing APIs, with explicit
  branding where it prevents unsafe composition (e.g. `TrustedCommerceRuntime` vs
  `GovernedAgentCommerceRuntime`).
- Ensure agent tool generation cannot auto-discover lower-level purchasing APIs.
- Prevent an `EdgeCommerceRuntime` being passed as an agent tool collection.
- If `EdgeBuyer` stays public for trusted integrations, mark it unsafe-for-agent
  by naming/type, not only docs.

---

## 6. Required adversarial tests

**Bypass:** agent cannot — call `payment.pay()` directly; call a signer directly;
obtain `EdgeBuyer`; obtain raw ports; call an ungoverned `buy()`; purchase with no
active mandate; exceed `maxGrossSpend`; exceed per-token limits; pay an
unauthorized recipient; switch recipient/amount/token after authorization; replace
the prepared transaction after authorization; race two purchases against the same
budget; retry and double-pay; crash after dispatch and regain budget; obtain raw
signing via a purchasing callback; create an unauthorized binding obligation via
negotiation; smuggle a payment through a non-spend action; bypass policy through
`createEdge()`.

**Positive:** valid governed purchases work; non-binding discovery/negotiation
works; approved payment executes once; reservation commits once; definite
pre-execution failures abort/release; ambiguous post-dispatch failures stay held;
restart/recovery preserves reservation + idempotency; receipts reconstruct the
purchase authorization/execution chain.

---

## 7. Repository-wide bypass audit

Search the whole repository (source, examples, tests, docs) for anything handing
`createEdge(`, `EdgeBuyer`, `.buy(`, `.negotiate(`, `payment.pay(`, `sign:`,
`authority:`, `EdgeCommerceRuntime` to autonomous agents, LLM tools, MCP tools,
action registries, workflow engines, or plugin surfaces. Fix unsafe examples so
they don't teach handing trusted commerce runtimes to agents.

---

## 8. Backward compatibility

Do not break trusted machine/application use of `createEdge()` (hardware hosts,
wallet hosts, non-agent services) when explicitly configured. Provide a migration
path for code that currently exposes `createEdge().buy()` to agents. The goal is a
structurally enforced distinction between **trusted host commerce** and
**agent-controlled commerce**.

---

## 9. Documentation

Document the invariant:

> `createEdge()` is a trusted-host commerce primitive. Autonomous agents receive
> only the governed agent/commerce facade. Possession of `EdgeCommerceRuntime`,
> `EdgeBuyer`, a raw payment port, or a signer is privileged host authority.

Document the final flow and why capability checks are not authorization.

---

## 10. Phases

### P0 — release blockers
- Add governed `purchase:buy` (+ `purchase:negotiate`) action definition(s) wired to
  the reservation lifecycle; agents get commerce only via `executeAction`.
- Remove `.buyer` (and raw ports) from any agent-facing runtime; brand/isolate the
  trusted-host commerce API.
- Authorize canonical effects: build the real operation, derive effects, then
  `authorizeAndReserve`; execute exactly the authorized operation.

#### P0 landed — implementation notes

- **Architecture:** governed actions (not a second framework).
  `createGovernedPurchaseActions({ buyer, strategy?, negotiation? })` in
  `edge/src/governed-commerce.ts` returns `purchase:buy` / `purchase:negotiate`
  `EdgeActionDefinition`s for the existing registry, so they run through
  `createAgentEdgeRuntime().executeAction` and `GrantBoundAutonomyPolicy`.
- **Buyer split (no TOCTOU):** `EdgeBuyer.prepareBuy()` does discovery +
  negotiation + agreement preparation only (no approval, no payment);
  `EdgeBuyer.executePrepared(prepared, { skipAuthority: true })` executes exactly
  the prepared agreement. `buy()` is now `prepareBuy()` + `executePrepared()`, so
  trusted-host behaviour is unchanged (170 existing tests pass).
- **Canonical effects:** derived from the PREPARED agreement
  (`seller`/`price`/`tokenId`), never from agent payload claims; the same
  prepared agreement is what `executePrepared` pays.
- **`authorizeAndReserve`:** remains in the governed runtime
  (`agent-runtime.ts`), now covering `purchase:buy`; the buyer's own
  `authority.approve` is skipped on the governed path.
- **Agent surface:** `createAgentEdgeRuntime` exposes only
  `version`/`deviceId`/`executeAction` (no buyer, no ports). `createEdge()` keeps
  its trusted-host API, now aliased as `TrustedCommerceRuntime`.
- **Tests:** `edge/src/__tests__/governed-commerce.test.ts` (canonical effects,
  budget rejection with no execution, no raw buyer/ports, fail-closed when
  unregistered).
- **Residual (P1):** binding negotiation acceptance is signed during
  `prepare`; making the acceptance itself post-authorization, and full
  commit/abort/held + idempotency recovery, remain P1.

### P1 — lifecycle & correctness
- Own the reservation lifecycle end-to-end (commit/abort/held) in the governed
  path; wire `recover`/`reconcile` into `recoverPurchases()`.
- Govern consequential negotiation (binding acceptance).
- Enforce idempotency across retries/recovery with stable ids.

#### P1 landed — implementation notes

- **Reservation lifecycle (P1-1):** the governed runtime now aborts on a port
  `ok:false`, classifies thrown failures via `EdgeActionDefinition.classifyFailure`
  (default `'definitely-not-executed'`), and **holds** ambiguous post-dispatch
  failures (`EXECUTION_UNCERTAIN`) instead of releasing them. `purchase:buy`
  classifies pre-payment errors as definite and post-dispatch (payment/resource)
  errors as held. Recovery/reconciliation remains host-side via
  `GrantBoundAutonomyPolicy.recoverReservations` / `reconcileReservation`.
- **Binding negotiation (P1-2):** `EdgeBuyer.previewNegotiation()` runs a
  negotiation to the decision point without signing an acceptance (fails closed
  on the transport path); the governed `purchase:negotiate` action previews in
  `prepare`, authorizes the previewed terms, and signs the acceptance only in
  `execute` via `finalizeNegotiation()`. A binding obligation can no longer be
  created before `authorizeAndReserve`.
- **Residual (P1-3):** cross-retry idempotency with stable ids remains open.

### P2 — hardening
- Repository-wide bypass sweep + examples/docs.
- Type branding / tool-discovery guardrails.
- Adversarial test matrix in CI.

---

## 11. Deliverables (report on completion)

1. Previous privilege-escalation paths identified.
2. Architecture chosen.
3. Files changed.
4. Public API changes.
5. How canonical purchase effects are derived.
6. Where `authorizeAndReserve()` now occurs.
7. How transaction mutation after authorization is prevented.
8. How reservation commit/abort/recovery works.
9. How raw commerce access is kept away from agents.
10. Tests added (bypasses, races, crashes, retries).
11. Remaining trust assumptions / residual risks.

**Completion criterion:** no supported agent-facing execution path reaches a
commerce side effect without governed authorization of the actual operation and
its atomic reservation lifecycle.

---

## 12. Open questions

- **Q1** Should `purchase:*` actions be `effect: 'spend'` with canonical effects
  derived from the built payment tx (reusing `prepared-effects`), or a dedicated
  commerce-effect type?
- **Q2** Should the trusted `createEdge()` API be renamed/branded
  (`TrustedCommerceRuntime`) to make misuse obvious, or kept with documentation?
- **Q3** Where should the `GovernedCommerceRuntime` live — inside `edge` as a
  private module bound only to action definitions, or as an `agent-policy`-owned
  orchestration?
