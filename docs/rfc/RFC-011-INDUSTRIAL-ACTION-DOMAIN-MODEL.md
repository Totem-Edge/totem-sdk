# RFC-011: Industrial Action Domain Model & Extensibility — Units, Resources, Interlocks, Composition, and Vertical Profiles

**Status:** Draft — Phase A (units & resources, §4.1/§4.2) landed: `UnitRegistry` with dimensional analysis, `Quantity` parameter validation, `Resource`/`ResourceAddress` registry, and wire-unit conversion wired into the adapter. Phases B–H outstanding.
**Created:** 2026-09-23
**Authors:** Totem SDK Contributors
**Reviewers:** [Pending stakeholder assignment]
**Depends on:** RFC-010 (Industrial Action to RC — the correctness/promotion companion), RFC-004
**Touches:** `@totemsdk/industrial-action`, `@totemsdk/edge`, `@totemsdk/agent-policy`, `@totemsdk/authority`, `@totemsdk/storage`

---

## 1. Summary

RFC-010 makes `@totemsdk/industrial-action` a correct, safe, honestly-RC
**industrial profile on the governed edge runtime**. That is necessary but not
sufficient for the package to be *world-class and generalisable across
verticals*: its model today is a generic lifecycle engine (`kind` + parameters +
context + conditions + executor) with no notion of **what an industrial action
actually is**. It cannot express a temperature setpoint with units, a shared
valve with an interlock, a multi-step startup recipe, a definition version, a
device error taxonomy, or a mapping to an OPC-UA information model.

This RFC defines the **industrial domain model and extensibility layer**: a
stable, vertical-neutral **core** plus **profiles** that carry vertical depth.
It is intentionally broad in coverage and phased so the core lands first and
profiles follow. It assumes RFC-010's architecture (industrial
`EdgeActionDefinition`s on `EdgeActionRegistry`, authorization via
`GrantBoundAutonomyPolicy`, receipts via `EdgeReceipt`).

## 2. Motivation

### 2.1 Broad or deep — pick a layer

A single generic module cannot be both broad (works for mining, water, HVAC,
manufacturing, oil & gas, logistics) and deep (knows that a 22.5 °C setpoint on
a shared chiller needs a units check, a maintenance-window guard, and a
ramp-rate interlock). The resolution is **stable core + vertical profiles**:

- **Core** (this RFC §4): resource model, quantity/units, interlocks/safe-state,
  composition, versioning, events, error taxonomy, concurrency/scheduling,
  approvals, standards mapping — all vertical-neutral.
- **Profiles** (§5–6): pluggable bundles that configure the core for a vertical.

### 2.2 What is missing today

`@totemsdk/industrial-action/src/*` contains **zero** mentions of units,
interlocks, resources, workflows, scheduling, events, or versioning (verified by
grep). Parameters are bare `number`/`string`/`object` (`src/types.ts:21-30`),
condition types are a closed union (`src/types.ts:105-111`), and the only
temporal notion is `expiresAt` checked against `Date.now()`
(`src/proposal.ts:48-51`).

## 3. Design principles

1. **Core stays vertical-neutral.** Vertical words live in profiles, never in core types.
2. **Open extension points.** Units, resources, interlocks, error classes, and
   standards adapters are registries, not closed unions.
3. **Safety is declared, not improvised.** Interlocks and safe-state are
   first-class; rollback (RFC-010 §6.5) is not a safety mechanism.
4. **Everything versioned and observable.** Definitions, schemas, profiles, and
   events are versioned; every transition emits an event.
5. **Compose with, don't fork.** Build on `EdgeActionRegistry`, `StepEffects`,
   `EdgeReceipt`, mandates, storage, and the temporal framework.

## 4. Core domain model

### 4.1 Quantities and units

Replace bare `number` with typed quantities so unit errors are impossible:

```ts
export type Unit = '°C' | 'K' | 'bar' | 'kPa' | 'm3/s' | 'rpm' | '%' | 'mm' | /* … */;

export interface Quantity {
  value: number;
  unit: Unit;
}

export interface QuantitySchema {
  type: 'quantity';
  dimension: Dimension;          // e.g. temperature, pressure, volumetricFlow
  unit: Unit;                    // canonical unit for the definition
  min?: Quantity;
  max?: Quantity;
  step?: Quantity;
  precision?: number;
}

export interface UnitRegistry {
  register(unit: Unit, dimension: Dimension, toCanonical: (v: number) => number): void;
  convert(q: Quantity, to: Unit): Quantity;
  compatible(a: Unit, b: Unit): boolean;
}
```

- Dimensional analysis at validation time (`assertValidParameters`): a pressure
  cannot satisfy a temperature guardrail.
- Unit conversion at the boundary: definitions declare a canonical unit; adapter
  profiles (Modbus registers, OPC-UA nodes) declare their wire units; the core
  converts and records both in the receipt.
- `Quantity` extends the `ParameterType` union in `src/types.ts:21`; `number`
  remains for dimensionless values.

### 4.2 Resources, assets, and addresses

Industrial actions target **resources**, not strings. Model the ISA-95-style
hierarchy and protocol-neutral addressing:

```ts
export interface ResourceId { site: string; area?: string; asset: string; point?: string; }

export interface Resource {
  id: ResourceId;
  kind: 'sensor' | 'actuator' | 'controller' | 'gateway' | 'system';
  capabilities: EdgeCapabilitySet;      // support (edge model), not authorization
  addresses: ResourceAddress[];         // protocol bindings (§4.10)
  safeState?: SafeState;
  metadata?: Record<string, unknown>;
}

export interface ResourceAddress {
  protocol: 'modbus' | 'opcua' | 'bacnet' | 'mqtt-sparkplug' | /* … */;
  endpoint: string;                     // unitId/register, nodeId, object instance, topic
  unit?: Unit;                          // wire unit at this address
}
```

- `PreparedDeviceOp` (RFC-010 §6.1) carries `ResourceId` + resolved
  `ResourceAddress`, so effects and receipts are resource-scoped.
- A `ResourceRegistry` resolves `ResourceId` → `Resource`; it is a profile
  extension point (a site's asset tree).

### 4.3 Interlocks, permits, and safe-state

Safety is a first-class precondition, evaluated **before** authorization and
actuation, and re-checked where the device supports it:

```ts
export type InterlockKind = 'precondition' | 'mutual-exclusion' | 'permit' | 'emergency-stop';

export interface Interlock {
  id: string;
  kind: InterlockKind;
  /** Block actuation unless satisfied. */
  evaluate(ctx: InterlockContext): InterlockResult;
  /** Fail-safe state to command when an interlock trips mid-operation. */
  safeState?: SafeState;
}

export interface SafeState {
  resourceId: ResourceId;
  command: PreparedDeviceOp;            // e.g. close valve, set output 0, de-energize
}

export interface InterlockRegistry {
  register(interlock: Interlock): void;
  /** All interlocks that guard a resource, in deterministic order. */
  forResource(id: ResourceId): Interlock[];
}
```

- **Precondition** — required permits/state (e.g. "chiller isolated").
- **Mutual-exclusion** — resource locks preventing conflicting actuation
  (e.g. two actions on one valve); enforced by the resource lock manager (§4.8).
- **Permit** — time-boxed human authorization for hazardous work.
- **Emergency-stop** — a global preempt that trips all matching interlocks and
  commands each resource's `safeState`.
- Interlock failures produce `REQUIRES_HUMAN`/`POLICY_REJECTED` semantics
  consistent with the edge runtime, never a silent bypass.

### 4.4 Action composition (recipes, workflows, sagas)

Real operations are multi-step. Add a composition layer that compiles to a
sequence of governed single actions:

```ts
export interface ActionStep {
  id: string;
  definition: string;                   // industrial action kind
  params: Record<string, unknown>;
  dependsOn?: string[];                 // DAG edges
  when?: Condition[];                   // conditional inclusion
  compensation?: ActionStep;            // saga rollback step
}

export interface ActionRecipe {
  id: string;
  version: number;
  steps: ActionStep[];
  /** Parallelism / ordering constraints; default: dependency order. */
  concurrency?: number;
  /** Global timeout and abort policy. */
  policy?: ExecutionPolicy;
}
```

- The composer topologically orders steps, runs independent steps up to
  `concurrency`, and executes each through the governed runtime (so each step
  gets its own mandate check, reservation, receipt).
- On failure, run `compensation` steps in reverse dependency order (saga) and
  emit a composite receipt referencing each step's `EdgeReceipt`.
- A recipe is itself a registered action (`industrial:recipe:<id>`), so it is
  authorizable and auditable as one governed unit.

### 4.5 Definition and schema versioning

A definition change must never silently reinterpret an in-flight proposal:

```ts
export interface IndustrialActionDefinition {
  kind: string;
  /** Monotonic; proposals bind to the exact version. */
  version: number;
  schema: ActionSchema;
  // … (RFC-010 fields)
}
```

- Proposals record `definitionVersion` and `schemaHash`; `prepare` rejects if the
  resolved definition version no longer matches (fail closed, no reinterpretation).
- `EdgeActionRegistry` keys can include the version (`industrial:set-temp@3`) with
  the unversioned alias resolving to `latest`.

### 4.6 Lifecycle events and audit stream

Every transition emits a structured, ordered event for observability and
regulatory audit:

```ts
export type IndustrialActionEventType =
  | 'proposed' | 'validated' | 'guardrails_passed' | 'interlocks_passed'
  | 'authorized' | 'reserved' | 'actuation_started' | 'actuation_succeeded'
  | 'actuation_failed' | 'retried' | 'rolled_back' | 'settled' | 'rejected';

export interface IndustrialActionEvent {
  type: IndustrialActionEventType;
  actionId: string; proposalId: string; operationId: string;
  resourceId?: ResourceId;
  at: number;                            // injectable clock / chain block
  detail?: Record<string, unknown>;
}

export interface ActionEventSink { emit(event: IndustrialActionEvent): void | Promise<void>; }
```

- Events complement (do not replace) the run receipt graph
  (`docs/edge-agent-governance.md:141`); receipts are the cryptographic summary,
  events the operational timeline.
- A durable event sink reuses `@totemsdk/storage`.

### 4.7 Device error taxonomy

Normalize protocol errors into a retry/abort classification so retry policy
(RFC-010 §6.5) is vertical-aware:

```ts
export type DeviceErrorClass = 'transient' | 'permanent' | 'safety' | 'auth' | 'unknown';

export interface DeviceErrorTaxonomy {
  classify(protocol: ResourceAddress['protocol'], raw: unknown): {
    class: DeviceErrorClass;
    code: string;                        // normalized, e.g. 'MODBUS:ILLEGAL_DATA_ADDRESS'
    retryable: boolean;
    safeStateRequired: boolean;
  };
}
```

- Modbus exception codes, OPC-UA status codes, BACnet error classes, and
  Sparkplug/DDATA failures map into this taxonomy.
- `class: 'safety'` forces a safe-state command and never retries.

### 4.8 Concurrency and scheduling

- **Resource locks** — mutual exclusion per `ResourceId` (and declared resource
  groups), acquired through a durable CAS store so locks survive restart.
  Conflicting actions wait, fail, or queue per policy.
- **Maintenance windows** — actions may be constrained to windows
  (`temporal-framework` window primitive); outside a window → reject or defer.
- **Rate limits** — max actuations per resource per epoch (temporal rate-limit
  template), protecting devices and preventing oscillatory control.
- **Priority and preemption** — safety/e-stop actions preempt queued work.

### 4.9 Approvals and human-in-the-loop

- Reuse the edge runtime's `requires_human` boundary escalation
  (`packages/edge/src/agent-runtime.ts:128`) rather than inventing a second
  approval path.
- Define **approval requests** as first-class records bound to the action's
  commitment (narrow, expiring, run-bound), so an approval cannot be replayed
  onto a different action (aligns with RFC-010 §6.4 authority binding).
- Permit-based interlocks (§4.3) are the hazardous-work special case.

### 4.10 Standards mapping

Profiles translate between the core model and industrial standards:

| Standard | Mapping |
|---|---|
| **OPC-UA** | `ResourceAddress.nodeId`; information-model types → `ActionSchema`; status codes → error taxonomy |
| **Sparkplug B** | MQTT UNS topic → `ResourceId`; metrics → `Quantity`; STATE/birth-death → resource lifecycle |
| **ISA-95** | `ResourceId` hierarchy (`site/area/asset/point`) |
| **BACnet** | object/instance addressing → `ResourceAddress`; error classes → taxonomy |
| **Modbus** | unit/register addressing → `ResourceAddress`; exception codes → taxonomy |

Mappings are **adapters in profiles**, never in core types.

### 4.11 Failure semantics

Success/failure is insufficient for physical actuation. Every industrial action
declares a **failure mode** that fixes what happens to the device, the
reservation, retries, and the audit trail when an attempt does not confirm.

```ts
export type FailureMode =
  | 'fail-safe'        // command the resource's declared SafeState
  | 'fail-silent'      // leave the device as-is; suppress further actuation
  | 'fail-closed'      // lock out the resource until an operator resets
  | 'fail-operational' // continue on a declared fallback / redundant path
  | 'abort';           // cancel atomically, no device side effects

export type ActionOutcome =
  | 'confirmed' | 'failed' | 'unknown'
  | 'aborted' | 'safe-stated' | 'suppressed' | 'requires-reset';
```

| Mode | Device on failure | SafeState | Reservation | Retry | Typical use |
|---|---|---|---|---|---|
| `fail-safe` | command `SafeState` | **required** | abort | no for `safety`/`permanent`; policy may retry `transient` | hazardous writes (valves, motors, heaters) |
| `fail-silent` | none (leave as-is) | n/a | abort | no | advisory/read, non-hazardous, best-effort |
| `fail-closed` | disable / lock out | resource lock | abort | no | safety-critical until human reset |
| `fail-operational` | switch to fallback path | n/a | commit fallback | fallback path only | redundant control / HA |
| `abort` | none (pre-actuation only) | n/a | abort | no | validation / authorization failures |

Rules:

1. **Declaration is mandatory for writes.** A `write`-effect action without a
   `failureMode` fails definition validation; `read` defaults to `fail-silent`.
2. **`unknown` is not `fail-silent`.** A timeout or thrown actuation is
   `unknown` and must route through the declared mode (e.g. `fail-safe` commands
   safe state). `fail-silent` is an explicit, deliberate no-op and is never the
   default for a timeout.
3. **Safety errors never retry** (§4.7 `class: 'safety'`): they command safe
   state and, where required, transition to `fail-closed`.
4. **Reservation semantics:** `abort` and `fail-safe` abort the reservation;
   `fail-operational` commits the fallback execution; `fail-closed` aborts and
   marks the resource `requires-reset`.
5. **Idempotency:** the deterministic `operationId` (RFC-010 §6.6) plus the
   recorded outcome make a repeated `fail-safe` action a no-op (safe state
   already commanded), while a repeated `fail-silent` action is suppressed.
6. **Audit:** the `ActionOutcome` and the mode are recorded in the receipt and
   event stream (§4.6).

A resource used by a `fail-safe`/`fail-closed` action **must** declare a
`SafeState` (§4.3); a definition targeting a resource without one is rejected at
registration.

## 5. Extensibility and capability model

- **Profile** — a bundle of registrations that configures the core for a vertical:

  ```ts
  export interface IndustrialProfile {
    id: string; version: number;
    units?: UnitRegistry;
    resources?: ResourceRegistry;
    interlocks?: InterlockRegistry;
    errorTaxonomy?: DeviceErrorTaxonomy;
    definitions?: IndustrialActionDefinition[];
    recipes?: ActionRecipe[];
    capabilities?: EdgeCapability[];      // vertical capability strings
  }
  ```

- **Capability strings** extend the edge `domain:action` convention
  (`packages/edge/src/capabilities.ts`) with vertical namespaces
  (e.g. `industrial:water:pump-control`, `industrial:hvac:setpoint`).
- **Registries are injectable** and default-empty, so a bare deployment is
  generic and a vertical deployment is deep.
- **No core edits to add a vertical** — a profile is data + adapters.

## 6. Vertical profiles (illustrative)

| Vertical | Units | Resources | Interlocks / safety | Composition | Standards |
|---|---|---|---|---|---|
| **Water/wastewater** | m3/s, mg/L, bar | pump, valve, tank, analyzer | dry-run, overflow, backflow, lockout | pump-start recipe | Modbus, OPC-UA |
| **HVAC** | °C, %, Pa | AHU, chiller, VAV, damper | min/max setpoint, freezestat, fan interlock | occupancy ramp | BACnet, Modbus |
| **Manufacturing** | mm, N·m, rpm, % | robot, CNC, conveyor | light curtain, e-stop, tool interlock | batch/job recipe + saga | OPC-UA, Modbus |
| **Oil & gas** | bar, m3/h, °C | wellhead, compressor, valve | high-high trip, permit-to-work | startup/shutdown sequence | OPC-UA, Sparkplug |
| **Mining** | t/h, mm, rpm, % | crusher, conveyor, mill | belt-slip, blockage, LOTO | crusher-start sequence | Modbus, OPC-UA |
| **Logistics** | m, kg, count | AGV, sorter, door | zone mutual-exclusion, e-stop | pick/pack flow | MQTT/Sparkplug |

Each profile supplies the §5 bundle; the core (§4) is unchanged.

## 7. Conformance and testing

- **Profile conformance suite** — a reusable harness (like the edge adapter
  contract) that any profile must pass: unit round-trips, resource resolution,
  interlock ordering, error classification, recipe DAG/compensation, event
  ordering.
- **Simulation and fault injection** — adapters expose a simulator that can
  inject timeouts, protocol errors, partial actuation, and interlock trips; the
  RFC-010 policy and safe-state paths are tested against it.
- **Property-based safety tests** — e.g. "no actuation without a satisfied
  interlock", "no double-actuation of a non-idempotent op", "every failure path
  reaches a declared safe state".
- **Real-system E2E** — per RFC-010 P6, extended per profile.

## 8. Phases

| Phase | Work | Depends on |
|---|---|---|
| **A** Units & resources | §4.1, §4.2; `QuantitySchema`, `ResourceRegistry`; adapter wire-unit mapping | RFC-010 P1 |
| **B** Safety | §4.3 interlocks/safe-state, §4.11 failure semantics (`FailureMode`/`ActionOutcome`), §4.8 resource locks | A |
| **C** Error taxonomy | §4.7; Modbus/OPC-UA/BACnet classifiers | B |
| **D** Composition | §4.4 recipes/sagas as governed actions | B |
| **E** Versioning & events | §4.5, §4.6 | A |
| **F** Scheduling & approvals | §4.8 windows/rate-limits, §4.9 | B, E |
| **G** Standards adapters | §4.10 (OPC-UA, Sparkplug, BACnet, Modbus) | A, C |
| **H** Profiles | §5–6; ship ≥2 reference verticals + conformance suite | A–G |

## 9. Open questions

- **Q1** Quantity library: hand-rolled `Unit`/`Dimension` registry vs a vetted
  units dependency (bundle-size + audit implications)?
- **Q2** Interlock evaluation location: purely in the gateway/agent, or also
  enforced on-device where the PLC supports it (defense in depth)?
- **Q3** Recipe durability: does a multi-step recipe become a durable saga
  (resumable across restart) in the core, or per-profile?
- **Q4** Event sink: push to an existing observability transport (MQTT/UNS) or
  keep it storage-only with an outbox?
- **Q5** Capability namespace ownership: extend `@totemsdk/edge`'s
  `EdgeCapability` union, or keep vertical capabilities as profile-local strings?
- **Q6** Which two reference profiles ship first (candidates: water + HVAC, or
  manufacturing + oil & gas)?

## 10. References

- `docs/rfc/RFC-010-INDUSTRIAL-ACTION-RC.md` — correctness/promotion companion
- `docs/edge-agent-governance.md` — governed runtime, canonical namespaces, receipt graph
- `docs/temporal-framework-design.md` — window/rate-limit/deadline primitives
- `packages/edge/src/{action-registry,agent-runtime,capabilities,receipts}.ts`
- `packages/agent-policy` — `StepEffects`, `GrantBoundAutonomyPolicy`
- `packages/authority/src/types.ts` — `MandateConstraint`, scope matching
- `packages/industrial-action/src/types.ts` — current schema/condition unions
