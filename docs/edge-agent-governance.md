# Edge Agent Governance

> Universal enforcement coverage does not mean universal agent access.

This document describes the governed agent runtime: how every Edge activity is
routed through a universal action registry, how the agent is restricted to a
deliberately selected subset, and how authorization is derived from real
operations rather than agent descriptions.

## The governing equation

> Effective authority = signed mandate ∩ local autonomy profile ∩ verified operation effects ∩ current run state

The agent can only invoke activities covered by its mandates and local autonomy
profile. The framework governs **all** Edge runtime activities; each agent sees
only a deliberately selected subset.

## Architecture

```
AgentEdgeRuntime (the ONLY thing the agent holds)
  └─ executeAction(action)
       ├─ 0. ungrantable check        → hard deny (seed, raw signing, key-lease, ...)
       ├─ 1. resolve action           → EdgeActionRegistry
       ├─ 2. capability check         → EdgeCapabilitySet (support, not authorization)
       ├─ 3. prepare / simulate       → wallet builds the real operation FIRST
       ├─ 4. derive effects            → canonical security facts from the built tx
       ├─ 5. authorize + reserve      → GrantBoundAutonomyPolicy (atomic)
       ├─ 6. execute                  → through the private port
       └─ 7. commit / abort           → run receipt graph
```

The raw ports are **not** exposed through the agent-facing runtime. Trusted
application code may retain the lower-level `createEdgeRuntime`, but the agent
receives only the governed facade.

## Canonical action namespaces

| Domain      | Example actions                                                           |
| ----------- | ------------------------------------------------------------------------- |
| Payments    | `payment:send`                                                            |
| Omnia       | `omnia:channel:open`, `omnia:pay`, `omnia:settle`, `omnia:splice`         |
| Proofs      | `proof:create`, `proof:verify`                                            |
| Lookup      | `lookup:query`, `lookup:announce`                                         |
| Location    | `location:claim:create`, `location:trail:create`, `location:proof:create` |
| Identity    | `identity:resolve`, `identity:verify`                                     |
| Manifests   | `manifest:sign`, `manifest:verify`                                        |
| Liquidity   | `liquidity:balance:read`, `liquidity:utxo:read`                           |
| Pub/sub     | `transport:publish`, `transport:subscribe`                                |
| Streams     | `transport:send`                                                          |

Each action adapter derives canonical effects from the **real** prepared
operation before authorization. Agent-supplied `amount`, `recipient`, `risk`, or
metadata remain explanatory hints — never security facts.

## Authorize actual effects

Spend actions (`payment:send`, `omnia:pay`, `omnia:settle`, `omnia:splice-out`,
`omnia:pay-multihop`) build the transaction first (coin selection + outputs),
then derive effects from the real outputs:

- **Change** back to the wallet's own addresses is excluded from spends.
- **Channel-internal** outputs back to the channel script are excluded (state
  change, not spend).
- The committed receipt reflects the real spend, not the agent's claimed amount.

## Ungrantable activities

The agent can never directly receive access to:

- Seed export, private keys, session seeds
- Raw signing primitives
- WOTS key-lease reserve/commit/burn
- Policy replacement
- Unrestricted raw port handles
- Identity-root rotation (unless routed through a dedicated governance flow)

Key-lease operations remain **internal consequences** of an authorized signing
action — the runtime reserves the key, signs, then commits (or burns on
failure) automatically. They are never agent-callable actions.

## Scope examples

A **maintenance agent** might receive mandates for:

```text
identity:resolve
lookup:query
location:claim:create
proof:create
proof:publish
```

while being denied payments and transport publication.

A **rebalancing agent** might receive:

```text
omnia:*
payment:send
liquidity:balance:read
```

with recipient, token, total-spend, fee, channel, duration and step-count
limits.

An **observational agent** could receive only read and verification operations.

## Boundary escalation

When a step exceeds existing bounds, the policy returns a structured request —
never a silent bypass:

```json
{
  "outcome": "requires_human",
  "boundary": "run.maxGrossSpend",
  "remaining": "25",
  "requested": "40",
  "suggestedGrant": {
    "scope": "omnia:channel:pay",
    "maxTotal": "15",
    "expiresInMs": 300000,
    "bindToRunId": "fleet-rebalance-42"
  }
}
```

Human approval should produce a narrow, expiring, run-bound mandate amendment.
It must not turn a rejection into an untracked bypass.

## Receipt graph

Every authorized step is committed to a run receipt graph containing:

- Run identity and profile version
- Every step's canonical action digest
- Mandates used
- Authority decision IDs
- Reservations and usage deltas
- Execution and postcondition proofs
- Failures and compensations
- Final remaining grant budgets

This makes an autonomous workflow reconstructable and auditable, not merely a
sequence of approved calls.

## Implementation

- `packages/edge/src/action-registry.ts` — `EdgeActionDefinition`, registry, ungrantable deny-list
- `packages/edge/src/actions.ts` — builtin definitions for every domain
- `packages/edge/src/agent-runtime.ts` — `createAgentEdgeRuntime` governed facade
- `packages/edge/src/prepared-effects.ts` — effects derived from real built transactions
- `packages/agent-policy/src/grant-bound-autonomy.ts` — `GrantBoundAutonomyPolicy`
- `packages/agent-policy/src/sqlite-run-state-store.ts` — durable atomic run/grant store
- `packages/omnia-pool/src/autonomous-rebalance.ts` — the Omnia vertical slice
