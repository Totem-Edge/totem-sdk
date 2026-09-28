# Edge agent-commerce privilege escalation — independent audit (2026-09)

**Date:** 2026-09-28
**Scope:** `@totemsdk/edge` commerce surface — `createEdge()`, `EdgeCommerceRuntime`,
`EdgeBuyer`, `buy()`/`negotiate()`, the economic commit barrier,
`createAccountedPurchaseAuthority()`, `createAgentEdgeRuntime()`, `EdgeActionRegistry`,
`GrantBoundAutonomyPolicy`, raw commerce/payment/authority ports.
**Method:** source review of the executable call graph + public exports; the
purchasing path was traced from every agent-capable entry point.
**Companion contract:** [RFC-019](../rfc/RFC-019-GOVERNED-AGENT-COMMERCE.md)

> The objective of this audit is narrow and concrete: find **every** way an
> autonomous/untrusted agent can reach a commerce side effect (purchase, payment,
> binding negotiation, signature, resource commitment) **without** passing through
> the same governed authorization/reservation boundary used by
> `createAgentEdgeRuntime()`.

---

## 1. Executive summary

`createAgentEdgeRuntime()` is correctly governed: `resolve → capability →
prepare → deriveEffects → GrantBoundAutonomyPolicy.authorizeAndReserve → execute →
commit/abort`, with ungrantable actions denied before any port is touched.

**The commerce surface is not on that path.** There is **no governed `purchase:*`
action** in the `EdgeActionRegistry`, and `createEdge()` exposes an alternate,
ungoverned purchasing API (`buy()`, `negotiate()`, and the raw `buyer`) that calls
a read-only `authority.approve()` and then a raw `payment.pay()`. The result is a
direct agent privilege-escalation path around the governed runtime.

| Severity | Count |
|----------|-------|
| Critical | 2 |
| High | 4 |
| Medium | 3 |

---

## 2. Threat model — ways an agent reaches an economic side effect ungoverned

The governed boundary is `AgentEdgeRuntime.executeAction` (pipeline in
`agent-runtime.ts:54-160`). Anything an agent can call that produces a payment,
binding agreement, signature, or resource commitment **without** that pipeline is
a finding.

1. **No governed purchase action.** `rg "purchase:"` over `actions.ts`,
   `action-registry.ts` and `index.ts` returns nothing. The registry has
   `payment:send`, `omnia:*`, `proof:*`, etc., but **no purchase action**. So the
   governed runtime literally cannot purchase; agents are pushed to the
   ungoverned path. (`actions.ts` builtins, `action-registry.ts`.)
2. **`createEdge().buy()` / `.negotiate()` are ungoverned.** `create-edge.ts:363-401`
   returns `{ buyer, buy, negotiate, … }`. `buy()` → `EdgeBuyer.buy()` →
   `executeAgreement()` → `authority.approve()` (`buyer.ts:713`) → `payment.pay()`
   (`buyer.ts:725`). No `deriveEffects`, no `authorizeAndReserve`, no reservation.
3. **The runtime hands back the raw buyer and raw ports.** `createEdge` consumes
   `payment`, `authority`, `sign`, `verifySignature` (`create-edge.ts:100-118`) and
   returns `buyer` (`:189,:364`). An agent given `EdgeCommerceRuntime` can call
   `buyer.buy()`, `buyer.pay`, or reach the injected `payment`/`sign` closures.
4. **`EdgeBuyer` / `EdgeCommerceRuntime` are public exports.**
   `packages/edge/src/index.ts:94,127` export `createEdge`, `EdgeCommerceRuntime`,
   `EdgeBuyer`, `NegotiationEngine`, `createPurchaseSession`. There is no
   trusted-vs-agent separation, branding, or type-level guard.
5. **Authorization sees descriptive intent, not canonical effects.** The buyer
   authorizes `agreement.terms` and pays `agreement.seller`/`terms.price`
   (`buyer.ts:713,725-731`). It never builds the real payment operation or derives
   effects from a built transaction (contrast `payment:send` → `prepared-effects`).
6. **The reservation lifecycle is caller-driven, not owned.** The buyer calls only
   `authority.approve`; it never calls `commit`/`abort`/`reconcile`
   (`rg "\.commit\(|\.abort\(" buyer.ts` → none). `createAccountedPurchaseAuthority`
   documents that "callers MUST drive commit/abort" (`accounted-authority.ts:84-88`).
7. **Negotiation is ungoverned and can be economically binding.** `negotiate()` is
   returned raw; agreements carry `buyerSignature`/`sellerSignature`
   (`buyer.ts:693-694`); no policy constrains providers, price, rounds, or
   binding acceptance.
8. **Ungrantable boundary is not enforced through commerce.** The buyer holds
   `sign`; purchasing is not in `UNGRANTABLE_ACTIONS`, so commerce is a possible
   indirect route to signing unless the purchase action is built to keep it
   internal.

---

## 3. Findings

### Critical

| ID | File | Problem |
|----|------|---------|
| **EDGE-COMM-001** | `actions.ts`, `action-registry.ts`, `index.ts` | **No governed `purchase:*` action exists.** The only purchasing paths are `createEdge().buy()`/`negotiate()` and `EdgeBuyer.buy()`, none of which go through `executeAction`/`authorizeAndReserve`. |
| **EDGE-COMM-002** | `create-edge.ts:165-196,363-401`; `index.ts:94,127` | **`createEdge()` exposes an alternate agent-facing commerce entrance:** it returns `buyer` (`EdgeBuyer`) and `buy`/`negotiate`, and is publicly exported with no trusted/agent separation. Handing an agent an `EdgeCommerceRuntime` grants ungoverned purchasing plus the injected raw `payment`/`authority`/`sign` ports. |

### High

| ID | File | Problem |
|----|------|---------|
| **EDGE-COMM-003** | `buyer.ts:699-738` | Authorization is on agent/negotiation-claimed values (`intent`, `agreement.terms`), not canonical effects derived from the actual built operation. `payment.pay()` then executes with the claimed recipient/amount/token. A custom payment port can build a materially different tx → TOCTOU. |
| **EDGE-COMM-004** | `buyer.ts:713`; `accounted-authority.ts:84-88` | The buyer never drives the reservation lifecycle (`commit`/`abort`/`reconcile`). With `createAccountedPurchaseAuthority`, reservations are left open unless the caller remembers to settle them; concurrent purchases can each observe the same budget. |
| **EDGE-COMM-005** | `create-edge.ts:174-179`; `buyer.ts` negotiation path | `negotiate()` is ungoverned and can produce signed, economically binding agreements with no policy on provider/price/rounds/lifetime. |
| **EDGE-COMM-006** | `index.ts:94,127-217` | No structural trusted-vs-agent separation: `EdgeBuyer`, `EdgeCommerceRuntime`, `NegotiationEngine`, `createPurchaseSession` are all public; `createEdge()` returns `.buyer`; docs/examples teach `edge.buy()`. |

### Medium

| ID | File | Problem |
|----|------|---------|
| **EDGE-COMM-007** | `accounted-authority.ts` (`recover`/`reconcile`) | Conservative HELD/`definitely-not-executed` reconciliation exists but is not wired into the buyer or `recoverPurchases()`; crash-after-dispatch reservation state is not surfaced by the purchase path. |
| **EDGE-COMM-008** | `create-edge.ts:100-118`; `buyer.ts:74` | `EdgeAuthorityPort.approve` is a simple allowed/denied read-only decision; there is no run/mandate reservation semantics by default, so the default path is weaker than `authorizeAndReserve`. |
| **EDGE-COMM-009** | `buyer.ts` (sign usage) | Commerce can indirectly reach signing; the ungrantable boundary (`UNGRANTABLE_ACTIONS`) is not extended to the purchasing surface. |

---

## 4. Call graph (verified)

```text
createEdge(opts)                         [trusted host]
  ├─ EdgeBuyer({ sign, payment, authority, lookup, ... })
  ├─ buy()      → buyer.buy()      → executeAgreement() → authority.approve() → payment.pay()
  ├─ negotiate()→ buyer.negotiate()
  └─ buyer, seller                        [raw handles returned]

createAgentEdgeRuntime(opts)             [agent facade — GOVERNED]
  executeAction(input)
    → isUngrantableAction? → deny
    → registry.resolve(action)
    → hasCapability
    → def.prepare(input)
    → def.deriveEffects(prepared)         [canonical effects]
    → GrantBoundAutonomyPolicy.authorizeAndReserve(...)
    → def.execute(prepared)
    → policy.commit() | policy.abort()
  (no purchase:* definition exists)
```

The two graphs are **disjoint**: commerce never enters the governed pipeline.

---

## 5. Required architecture (see RFC-019)

Agent commerce must be exposed **only** as governed actions:

```text
Agent → AgentEdgeRuntime.executeAction('purchase:buy')
  → EdgeActionRegistry (purchase:buy)
  → governed commerce orchestration (discovery / negotiation / agreement)
  → economic commit barrier (revalidate durable state, expiry, identity)
  → build the ACTUAL payment/resource operation
  → derive canonical effects from that operation
  → GrantBoundAutonomyPolicy.authorizeAndReserve(...)
  → execute exactly the prepared operation
  → commit / abort / held-for-reconciliation
  → governed receipt graph
```

`createEdge()` may remain a **trusted-host** primitive, but it must not be a
supported agent-facing path around `executeAction()`.

---

## 6. Adversarial test matrix (must exist)

Bypass (agent cannot): call `payment.pay()` directly; call a signer directly;
obtain `EdgeBuyer`; obtain raw ports; call an ungoverned `buy()`; purchase with no
active mandate; exceed `maxGrossSpend`/per-token limits; pay an unauthorized
recipient; switch recipient/amount/token after authorization; replace the prepared
transaction after authorization; race two purchases against the same budget; retry
and double-pay; crash after dispatch and regain budget; obtain raw signing via a
purchasing callback; create an unauthorized binding obligation via negotiation;
smuggle a payment through a non-spend action; bypass policy through `createEdge()`.

Positive: valid governed purchases work; non-binding discovery/negotiation works;
approved payment executes once; reservation commits once; definite pre-execution
failure aborts; ambiguous post-dispatch failure stays held; restart/recovery
preserves reservation + idempotency; receipts reconstruct the purchase chain.

---

## 7. Production gate

> There must be **no supported agent-facing execution path** by which an autonomous
> agent can reach a commerce side effect without governed authorization of the
> actual operation and its atomic reservation lifecycle.

Concretely: a governed `purchase:*` action exists; agent-facing runtimes never
expose `EdgeBuyer`/raw ports; authorization is on canonical effects derived from
the executed operation; reservations are atomic and owned by the execution path;
negotiation is governed where consequential; and the adversarial test matrix above
passes.
