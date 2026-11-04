# RFC-076: SunSpec observations and governed inverter controls

**Status:** Draft — approved design direction; implementation and qualification remain to be completed.

**Created:** 2026-11-04

**Authors:** Totem SDK Contributors

**Depends on:** RFC-010/011 (industrial actions and resources), RFC-022
(prepared commands and reconciliation), RFC-023 (physical effects), RFC-024/025
(act-package precedent), RFC-063/074 (readiness, transport qualification and
fail-closed gates).

**Touches:** new packages `@totemsdk/edge-sunspec` (read-only observations) and
`@totemsdk/act-sunspec` (governed controls); `@totemsdk/edge-modbus` is consumed
and **does not change its root API, PDU contract or sidecar protocol**.

**Baseline:** `main` at `d0b218ef` (2026-11-04). RFC number 076 is free at the
time of writing; 075 remains unused. Pin the implementation baseline in P0.

---

## 1. Decision and intended result

Add SunSpec support as **two packages**, not as subpaths of `edge-modbus`:

| Package | Layer | Responsibility | First maturity |
|---|---|---|---|
| `@totemsdk/edge-sunspec` | Sense | SunSpec discovery, pinned model catalogue, exact codecs, typed observations, scheduling, optional evidence bridge | `rc`, `next` |
| `@totemsdk/act-sunspec` | Act | Governed industrial action definitions for explicitly qualified controls | `rc`, `next` |
| `@totemsdk/edge-modbus` | Wire | Existing register/coil gateway, PDU contract, Go sidecar — unchanged | stays `v1` |

A developer should be able to point `edge-sunspec` at an existing
`edge-modbus` gateway, discover a compatible inverter or meter, receive typed,
quality-aware power and energy observations, and attach Totem evidence. Where a
specific device and control have passed qualification, `act-sunspec` resolves an
engineering request into an exact register operation and executes it through the
governed runtime (`act-core`), with commitment binding, physical effects,
readback reconciliation and durable, at-most-once dispatch.

The first delivery is **read-only**. Control support has a separate acceptance
gate. SunSpec decoding, real-device compatibility, production support and formal
SunSpec certification are recorded independently and never inferred from one
another.

## 2. Why two packages (decision record)

The original proposal placed both read-only support and governed controls inside
`@totemsdk/edge-modbus` as optional subpaths. That was rejected for four reasons:

1. **Sense/Act boundary.** The SDK now separates `edge-*` (wire/Sense) from
   `act-*` (governed Act). A control factory inside `edge-modbus` recreates a
   private act layer and makes the wire package depend on `act-core`.
2. **Dependency isolation.** A read-only client must work without `act-core`, a
   signer, `@totemsdk/proof` or a chain. Optional peer dependencies leak through
   declaration graphs; a separate package makes the guarantee structural.
3. **Independent maturity and release.** Discovery/decoding and control safety
   have different evidence. Separate packages can be promoted, qualified and
   released separately, and a control regression cannot force a wire release.
4. **Packaging simplicity.** `edge-modbus` currently exports only `.`. Adding
   multiple subpath entry points multiplies build, declaration, consumer and
   compatibility surface for no functional benefit; `edge-sunspec` can depend on
   `edge-modbus` directly.

`edge-modbus` therefore gains **no new exports and no version bump** in this
design. If a shared primitive is genuinely missing (e.g. a bounded multi-register
read helper), that is a separate additive change with its own evidence.

## 3. Problem and current implementation

`@totemsdk/edge-modbus` (v0.2.2, `v1`, Tier 1) provides:

| Component | Current responsibility | Reuse |
|---|---|---|
| `ModbusTransportPort` | injected serial/network exchange | unchanged |
| `createModbusGateway` | register/coil reads and writes, request/response validation | used by `edge-sunspec` as a structural register port |
| `NativeModbusTransport` + Go sidecar | TCP/RTU host binding | unchanged; FC16 write coverage must be proven before P3 |
| `createModbusSensorBridge` | polls configured addresses, forwards register arrays | unchanged; it does not discover models or decode SunSpec |
| `act-core` | prepared commands, effects, bounded execution, durable records, reconciliation | owns all control execution in `act-sunspec` |

The existing sensor bridge records configured values and a gateway timestamp. It
does not discover SunSpec model chains, decode model-specific types and scale
factors, establish direction/phase/source semantics, or distinguish energy
counters from instantaneous measurements. Its interval loop also permits overlap;
`edge-sunspec` introduces an explicit single-flight scheduler.

The gateway already treats a lost or malformed write acknowledgement as
`MODBUS_WRITE_OUTCOME_UNKNOWN` and never retries it automatically. That is a
required invariant for SunSpec controls and is preserved.

Existing qualification covers a macOS arm64 source build, loopback TCP simulator
and RTU framing/CRC tests. It does not establish serial hardware, inverter
compatibility or SunSpec certification; this design adds evidence and must not
widen those claims.

## 4. Goals and non-goals

### 4.1 Goals

1. Bounded, explicit SunSpec discovery on permitted Modbus units/addresses.
2. Deterministic decoding from a pinned, reviewed model catalogue.
3. Typed observations with exact numeric values, quality, provenance and time
   semantics.
4. Non-overlapping, fair polling per physical binding, with bounded queues,
   backoff, gap records and clean shutdown.
5. A declared model-support matrix and a versioned device qualification matrix.
6. Optional governed controls with per-function qualification, through the
   existing `act-core` lifecycle only.
7. ESM/CJS, strict declaration and packed-consumer coverage for every new
   package entry point.

### 4.2 Non-goals

- IEEE 2030.5/CSIP, OpenADR, DNP3, IEC 61850 or a utility DER service.
- A SunSpec server, cloud scraping, automatic LAN scanning or firmware updates.
- Direct battery CAN/BMS control, grid protection settings, anti-islanding
  changes or generic agent-accessible register writes.
- **Site export control.** `WMaxLimPct` limits the device's active-power output.
  Export limiting at the grid connection is a different operation requiring a
  commissioned site meter, topology and a qualified feedback controller.
- Formal SunSpec certification or grid-code conformance claims.

## 5. Standards, sources and licensing

The implementation follows the adopted SunSpec specifications and preserves
point names, types, units and access metadata. It must not assume every Modbus
inverter implements SunSpec, or that a SunSpec device implements a control.

Pin the machine-readable model definitions to the `sunspec/models` commit named
in P0 (proposed `90b4a331dcca1d6eac69c1bead952fddcc5852e0`), and record the
official reference implementation (`sunspec/pysunspec2`, proposed
`bbe9e044c2ae06af54b49e5ef042493eddb7e2b8`) as an independent interoperability
reference. Where reference behaviour and the adopted specification differ,
follow the specification and record the divergence in the catalogue manifest.

### 5.1 Licensing gate (P0, blocking)

The draft asserts Apache-2.0 attribution for incorporated model definitions.
**This must be verified before any generated catalogue is committed.** P0 must:

- obtain and record the redistribution terms for the SunSpec model files;
- decide whether generated layouts may be committed, vendored, or generated at
  install time (runtime must never fetch definitions);
- record licence and attribution in the package `NOTICE`/README and the
  catalogue manifest;
- add a CI check that fails if a generated catalogue lacks provenance metadata.

If redistribution is not permitted, generate layouts at build time from a
pinned, checksummed source and ship the generated output under the terms the
licence allows. The manifest remains mandatory either way.

### 5.2 Catalogue manifest

Checked in with the generated catalogue:

- upstream repository and full commit;
- adopted specification editions and dates;
- included model IDs and source file hashes;
- generated catalogue digest, generator version and layout test results;
- unsupported types/group structures (explicit, never silently skipped);
- licence and attribution records.

Definition upgrades are reviewed manifest changes with regenerated fixtures and
compatibility tests. Runtime discovery never downloads definitions, evaluates
downloaded code or depends on the SunSpec website.

## 6. Package architecture

### 6.1 `@totemsdk/edge-sunspec` (read-only)

```
src/index.ts              public API
src/types.ts              descriptors, values, snapshots, quality, errors
src/discovery.ts          identifier/model-chain discovery and identity binding
src/catalogue.ts          compiled layouts + manifest validation
src/codec.ts              pure register → point decoding
src/quantity.ts           exact numeric representation and conversion
src/projection.ts         model-qualified power/energy projections
src/scheduler.ts          binding-scoped single-flight scheduler
src/poller.ts             cycles, backoff, gaps, shutdown
src/proof-bridge.ts       typed observation batches via structural evidence ports
src/generated/            reviewed generated layouts + manifest
scripts/generate-sunspec-models.mjs
tests/unit/edge-sunspec/…/sunspec/
tests/qualification/edge-sunspec/
```

Dependency rules:

- `@totemsdk/edge-modbus` is a **runtime dependency** (gateway/gateway types only).
- **No** dependency on `act-core`, `@totemsdk/proof`, a signer or a chain.
- The evidence bridge takes structural ports (`proof`, `storage`) injected by the
  host; it does not import proof implementations.
- The codec/catalogue path is usable without sockets, a sidecar or Node globals.

### 6.2 `@totemsdk/act-sunspec` (governed controls)

```
src/index.ts              action-definition factory
src/prepare.ts            resolve qualified controls into immutable command plans
src/profile.ts            model/point/access profile per qualified device
src/reconcile.ts          configuration readback and outcome classification
src/effects.ts            RFC-023 effects from the prepared command
tests/unit/act-sunspec/
tests/qualification/act-sunspec/
```

Dependency rules:

- Depends on `@totemsdk/act-core`, `@totemsdk/edge-sunspec` and
  `@totemsdk/edge-modbus`.
- Returns existing `IndustrialActionDefinition` objects; the host compiles them
  with `toEdgeActionDefinition`. No parallel execution engine.
- Does not decrypt, discover or decode registers itself; it consumes
  `edge-sunspec` descriptors and the gateway's PDU operations.

### 6.3 Boundary rules

- SunSpec code never adds MBAP headers or RTU CRC bytes; the `edge-modbus`
  binding owns framing.
- All public addresses are zero-based Modbus PDU addresses.
- No Go protocol change is required for ordinary FC03/FC16 model access; the
  sidecar must be proven for the FC16 shape P3 uses before controls ship.
- Both packages build ESM+CJS with declarations and one root export (`.`).

## 7. Discovery contract

### 7.1 Addressing

Public addresses are **PDU addresses** (0–65535). Vendor documentation commonly
uses one-based 4xxxx/5xxxx notation; a UI or vendor profile translates once at
its boundary and records the translation.

The conventional discovery candidates are documentation bases 40000/50000 and
PDU base 0. Their PDU equivalents are **39999, 49999 and 0**. The candidate set
is a P0 decision validated against the reference client; it is recorded in the
device profile. Explicit host configuration always takes precedence.

Add a dedicated off-by-one test: PDU `39999` ↔ one-based `40000`, and a vendor
profile that supplies `40001` must translate to PDU `0`.

### 7.2 Identifier and chain

Read the two-register identifier `0x5375, 0x6e53`, then traverse model headers
using the advertised model ID and payload length. Advance by `2 + L` registers.
A complete chain ends with model ID `0xffff` and length zero. Model data lengths
exclude the ID/length header.

### 7.3 Bounds

| Limit | Default | Notes |
|---|---|---|
| Candidate bases per discovery | 3 | explicit config wins |
| Models per chain | 128 | |
| Total model-map span | 16,384 registers | also bounded by PDU space |
| Registers per read | 125 | or a lower device/profile limit |
| Concurrent physical exchanges per binding | 1 | enforced by the scheduler |
| Overall discovery deadline | 10 s | overridable for commissioned serial links |
| Queued poll cycles per device | 1 | older cycle dropped and recorded as a gap |

These are Totem resource limits, not SunSpec values.

Require valid unit/address/count ranges, forward progress, complete headers and a
valid end marker. Validate known layouts against actual instance lengths,
including padding and repeated groups; never hardcode one model's length.

Require a valid common-model instance first for the adopted profile. Keep
duplicate instances distinct by `(modelId, instanceOrdinal)` plus absolute
location. Skip valid unknown models by length and expose them as undecoded
descriptors. Malformed chains, arithmetic overflow, overlapping layouts and
exhausted budgets must not return a complete descriptor.

### 7.4 Error codes

| Code | Meaning | DeviceErrorClass |
|---|---|---|
| `SUNSPEC_NOT_FOUND` | every permitted candidate conclusively checked, no identifier | `permanent` |
| `SUNSPEC_DISCOVERY_INCOMPLETE` | timeout, communication error or scan limit prevented a conclusion | `transient` |
| `SUNSPEC_INVALID_MAP` | identified chain structurally invalid | `permanent` |
| `SUNSPEC_UNSUPPORTED_LAYOUT` | layout cannot be safely interpreted by the catalogue | `permanent` |
| `SUNSPEC_IO_ERROR` | transport failure during a read | `transient` |
| `SUNSPEC_QUALITY_INVALID` | point unavailable/invalid/not-implemented | not retryable |

Codes are stable strings; `cause` retains the underlying Modbus error and
unit/function/exception context. They map onto RFC-011's device error taxonomy so
`act-core` retry policy can consume them directly. An illegal-address response at
one candidate marks that candidate unavailable; a timeout remains a communication
failure.

### 7.5 Binding and cache invalidation

Bind descriptors to the commissioned resource, endpoint identity, unit ID, base
address, device-reported identity fields, ordered model locations/lengths,
catalogue digest and vendor-profile revision.

Manufacturer, serial and firmware are identification claims, not cryptographic
authentication. The trusted host owns commissioning and endpoint-to-resource
association. Revalidate after reconnect, reboot indication, firmware/model change
or descriptor-lease expiry. A changed identity or map invalidates prepared writes;
a reconnect must never attach a replacement device to the previous economic
identity.

## 8. Model coverage and delivery stages

| Stage | Models | Commitment |
|---|---|---|
| P1 | 1; 101–103; 111–113; 201–203; 211–213 | identity, integer/float inverter and meter decoding, model-specific projections |
| P2a | 120–122; 160; 701; 702 | ratings/status and basic DER AC measurements |
| P2b | 123 read-only; 124; 713; 802 | storage state and modern DER observations (no writes) |
| P3 | 123 controls | qualified active-power percentage limiting, enable and reversion semantics |
| P4 | selected 124/704 functions | separate profile, effects and hardware evidence per function |

Model numbers are not permission to claim every point or action. Model 121
contains writable settings; P2 reads them without exposing writes. Model 704
contains protection-related controls that remain out of scope. Model 801 is
deprecated; do not present it as the default battery interface.

Repeated/nested groups and synchronous-group semantics must be supported before
enabling a model that needs them. Unsupported structure produces an explicit
capability limitation, never shifted offsets or guessed values.

## 9. Numeric correctness and point quality

### 9.1 Exact values

Decode byte/word order from the adopted type definition; never heuristically swap
words until a plausible number appears.

For scaled integers retain: exact raw integer (decimal string), signed scale
factor, exact scaled decimal string, source type, model instance, point path and
register span. Use integer/decimal arithmetic (bigint internally) for scaling and
policy; encode integers as decimal strings in JSON. Preserve 64-bit counters
above `Number.MAX_SAFE_INTEGER`.

For floats retain the original IEEE bit pattern and a deterministic exact
representation of finite values; a rounded display value is separate. Never let
authorization or evidence depend on display rounding.

**Implementation traps that require explicit tests:**

- never use JS bitwise operators for `uint32` (`|0`, `>>`, `<<`) — they sign-flip
  above 2³¹;
- scale factor `-32768` (not implemented/reserved) must not be applied;
- `NaN`/`Infinity` float payloads follow the adopted per-type unavailable rule;
- zero accumulators may mean “not accumulated”; they never establish a billable
  zero baseline.

Reject non-finite values, invalid scales and unrepresentable control requests with
explicit quality/errors. Never clamp a device value into an apparently valid range.

### 9.2 Quality model

`valid | not-implemented | not-accumulated | invalid | unavailable | stale | incoherent`

A non-valid numeric observation has **no** usable numeric value. Preserve raw
registers and an explanatory reason. A failed read never becomes zero; cached
values retain their original sample time. Unknown enum values and event bits are
retained explicitly; strings are bounded device data and are escaped at
presentation.

### 9.3 Minimum independent vectors

| Input | Expected |
|---|---|
| uint16 `0x04d2`, scale −1 | exact `123.4` |
| int16 `0xff9c`, scale −1 | exact `-10` |
| uint32 `[0x0001, 0x0000]` | `65536` |
| uint32 `[0x8000, 0x0000]` | `2147483648` (not negative) |
| uint32 `[0xffff, 0xffff]` | `4294967295` |
| uint64 `[0x0020, 0, 0, 0x0001]` | `9007199254740993` |
| float32 `[0x3f80, 0x0000]` | `1` exactly |
| float32 `[0x7fc0, 0x0000]` | unavailable (NaN rule) |
| int16 `0x8000`, no scale | not implemented |
| scale factor `0x8000` | invalid/unsupported scale |
| zero accumulator | accumulator-specific quality; no settlement baseline |

Fixtures include model-specific scaling, counter boundaries and independently
prepared register images. Symmetric encode/decode tests are insufficient.

## 10. Public API (`edge-sunspec`)

| API | Purpose |
|---|---|
| `createSunSpecClient` | bind a structural read-only register port, catalogue and target |
| `client.discover()` | complete descriptor or typed error |
| `client.readSnapshot()` | read selected models/points from a validated descriptor |
| `createSunSpecScheduler` | binding-scoped single-flight scheduler shared by clients/pollers |
| `createSunSpecPoller` | bounded, non-overlapping observation cycles |
| `createSunSpecProofBridge` | batch typed observations through host-owned ports |

Discovery and reads return `EdgeOperationResult<T>`; invalid configuration fails
before I/O. Snapshots carry per-point quality and explicit cycle/model errors;
callers must not infer completeness from partial points.

```ts
import { createModbusGateway } from '@totemsdk/edge-modbus';
import { createSunSpecClient, createSunSpecScheduler } from '@totemsdk/edge-sunspec';

const gateway = createModbusGateway({ runtime, transport });
await gateway.start();

const scheduler = createSunSpecScheduler({ binding: 'commissioned-lan-inverter-01' });

const client = createSunSpecClient({
  registers: gateway,            // structural: holding-register reads only
  digest: canonicalDigestPort,   // host-owned, backed by SDK hashing
  unitId: 1,
  baseAddresses: [39999, 0, 49999], // PDU addresses
  catalogue: legacyPvModels,
  scheduler,
  target: { resourceId: 'paje-inverter-01', endpointId: 'commissioned-lan-inverter-01' },
});

const discovery = await client.discover();
const snapshot = discovery.ok && discovery.data
  ? await client.readSnapshot({ device: discovery.data, selection: 'measurements' })
  : undefined;
```

The scheduler is **required** when more than one client/poller can share a
binding; the client refuses to construct without one in that case. This prevents
`edge-sunspec` and `createModbusSensorBridge` from interleaving reads by accident.

## 11. Polling, coherence and recovery

- Completion-based or single-flight scheduling; no accumulating `setInterval`.
- One scheduler per physical binding, keyed by endpoint identity + unit, shared
  across devices on that binding; bounded per-device queues and fair access.
- Classify work: identity/configuration, routine measurements, alarms. Host
  configuration supplies the link budget.
- Bound requests to protocol/device limits and 125 registers. Keep a point and
  its scale factor in one coherent acquisition plan. If a snapshot needs multiple
  exchanges, record interval/skew; never claim atomicity.
- Respect synchronous groups; refuse operations requiring unsupported atomicity.
- Timers are `unref()`ed for CLI embedding. `stop()` prevents new cycles, drains
  or safely abandons the in-flight read, releases host subscriptions and never
  closes a gateway it does not own.

On timeout/reconnect: publish a communication/quality event; bounded read-only
backoff with jitter; retain last values with original times; revalidate the
descriptor before resuming; record a gap instead of inventing samples.

## 12. Evidence, persistence and settlement boundaries

The bridge consumes typed snapshots, never a second decoder, and uses structural
`proof`/`storage` ports supplied by the host.

**Budgets and retention (explicit defaults, configurable):**

- batch routine samples into bounded windows (default 5 minutes);
- **at most one signed evidence batch per window per device**, so WOTS leaves are
  not consumed per poll;
- before signing, consult the host lease budget; on exhaustion stop signing and
  emit an explicit evidence-disabled event — never reuse an index;
- store raw register blocks in the storage `ArtifactStore` (content-addressed),
  not inline; default retention is 7 days or a configured byte cap;
- a digest alone is insufficient when source bytes can no longer be retrieved;
- persist window sequence/gap records and pending evidence through the existing
  storage abstraction in durable mode;
- retries are idempotent by window/cycle id; no duplicate proofs.

Each record binds gateway/resource identity, acquisition times, model/point refs,
map/catalogue/profile digests, quality, raw-to-decoded relationship and
`assurance: 'gateway-observed' | 'device-signed'`. Ordinary Modbus readings are
never labelled device-authenticated.

Downstream metering/payment consumers (including Omnia) must independently
validate meter identity, counter continuity, direction, gaps and tariff. A counter
reset/wrap is an explicit discontinuity unless a qualified profile proves the
transition. This design does not generate energy certificates or settle payments.

## 13. Governed controls (`act-sunspec`)

### 13.1 Authority boundary

`createSunSpecActionDefinitions` returns existing `IndustrialActionDefinition`
objects registered through `toEdgeActionDefinition`; agents receive only
`AgentEdgeRuntime.executeAction`. Use existing `industrial:action` capability
checks and the narrow kind/resource mandate. `transport:modbus` is transport
support, not write authorization.

No agent/MCP tool receives a gateway, raw register address, writable point list,
mutable catalogue or control-definition factory. Trusted-host raw Modbus APIs
remain privileged infrastructure.

### 13.2 First action (P3)

Kind: `energy:inverter:limit-active-power`.

Profile: qualified model 123 functions. Accept a percentage ceiling, bounded
duration and supported ramp requirement; derive point selection and
enable/timing values from the profile. Do not expose grid-connection or
reactive-power settings through this action. Model 704 is a separate profile even
where fields look similar; storage/reserve changes need their own semantics.

A function is available only when the model/point exists, scale/access are
understood, the commissioned profile permits it, operating context is fresh and
qualification covers that function. Discovery alone never enables writes.

### 13.3 Prepared command

Preparation produces an immutable plan containing: resource/endpoint binding;
unit/base/model instance and map/catalogue/profile digests; definition/schema
versions and fresh context reference; exact ordered FC/address/value operations;
the original engineering request and the actual encoded value; scale factors and
trusted rating basis; enable/ramp/timeout/reversion semantics; expected readback
and any physical predicate; conservative effects and expiry.

The whole canonical command enters the existing prepared-command commitment.
Endpoint information is resolved into the command, not left in mutable transport
state. Immediately before the first write, recheck identity/map, critical scales,
expiry, interlocks and context; a mismatch aborts before dispatch.

### 13.4 Encoding and physical effects

Inverse scaling must produce a representable register value; reject unsupported
precision instead of rounding silently. If a future profile permits quantization,
the actual encoded value is bound and authorized.

RFC-023 effects derive from the prepared operation. A percentage limit requires
the trusted `WMax` basis from model 120/121 (with its own scale) — percentage
alone cannot produce watts. Include conservative power, duration and energy
envelopes and transition timing.

A temporary autonomous control requires device-enforced reversion or an
independently qualified local enforcement mechanism. Request expiry plus a host
timer is not proof of reversion after a host failure. Without a bounded profile,
expose observations and privileged commissioning workflows only. Device/BMS
protection and fast electrical loops retain local authority.

### 13.5 Dispatch and reconciliation

Prefer one documented FC16 write for a qualified contiguous group; never write
read-only gaps/padding to manufacture contiguity. Multi-exchange controls need an
explicitly qualified partial-failure contract; every possible write is
commitment-bound.

A matching Modbus acknowledgement establishes **protocol acceptance only**.
Reconcile with fresh readback of setpoint, enable and timing fields. Report
confirmation scope: `configuration-readback` or `physical-observation`; low PV
output alone never proves curtailment.

Uncertain outcomes use RFC-022's operation lifecycle and reservation hold. A lost
ack, crash after dispatch or malformed readback must not trigger blind
retransmission, budget release or a success receipt. Cancellation, restoration
and fail-safe writes are additional physical operations requiring a pre-authorized
committed path or a new authorization.

## 14. Security and transport

Legacy Modbus has no authentication. A spoofed gateway can lie about identity and
measurements; commissioning pins the endpoint association but is not
cryptographic. Threat model must state this, require network segmentation for
legacy hardware and record evidence as gateway-observed.

Where a qualified Modbus Security or Secure SunSpec binding exists, use its
authenticated transport and certificate lifecycle as a separately qualified
transport profile with the same semantic API and PDU boundary. The current Go
sidecar must not be advertised as TLS-capable because a standard defines it.

Model definitions and vendor profiles are trusted, reviewed configuration. A
device cannot supply executable decoding rules or expand endpoints/actions.

## 15. Vendor compatibility and GoodWe pilot

Use a versioned device/profile record: manufacturer + exact model + firmware +
communication module + transport/security mode + model-map digest + catalogue
revision + permitted function. Record monitoring, control and recovery evidence
independently. Discovery, a vendor alliance membership or a certificate for
another model does not substitute for this record.

The GoodWe pilot establishes local Modbus enablement, actual unit/base addresses,
point availability, sign conventions, update timing and write permissions on the
selected hardware. A proprietary map is identified as a vendor profile, never
labelled SunSpec.

A second manufacturer must exercise the shared path. At least one serial hardware
profile is required before claiming RTU device support; a TCP simulator plus CRC
unit tests is not sufficient. Evidence may redact owner/site details while
retaining device/firmware provenance.

## 16. Tests and acceptance

### 16.1 `edge-sunspec` suites

| Suite | Evidence |
|---|---|
| Codecs | signed/scaled values, widths, floats, sentinels, strings, enums, bitfields, lossless counters, uint32 sign-flip and SF-sentinel vectors |
| Discovery adversarial | alternate bases, wrong marker, bad lengths, unknown/duplicate models, missing terminator, address overflow, timeout, budget exhaustion, off-by-one base |
| Layout compiler | header offsets, dynamic/repeated/nested groups, synchronous requirements, deterministic generation, manifest digest |
| Observations | role/direction/phase mapping, source precedence, unavailable quality, counter reset/wrap, timestamp provenance |
| Poll/recovery | shared-link fairness, no overlapping cycles, bounded queue, reconnect, descriptor changes, gaps, clean shutdown, bridge/poller interleaving |
| Packaging | ESM/CJS, strict NodeNext declarations, packed consumer, pure read-only import with no act/proof/signer present |
| Sidecar integration | Go process against a scripted SunSpec TCP simulator; wrong unit/function/length, corrupted acknowledgement |
| Differential | independently prepared register images and selected pySunSpec2 comparisons with documented divergences |

### 16.2 `act-sunspec` suites

| Suite | Evidence |
|---|---|
| Command binding | no writes during discovery/preparation; exact command/effects binding; endpoint resolved into the command |
| Authority | denied/expired mandates; missing industrial capability; transport capability is not write auth |
| Numeric | changed scale/target aborts; unrepresentable values rejected; WMax basis correctness |
| Dispatch | FC16 contiguous write; no padding writes; multi-write partial-failure contract |
| Reconciliation | ack ≠ completion; configuration readback and physical observation separated |
| Uncertainty | lost ack, crash after dispatch, durable restart, held reservation, no redispatch |
| Reversion | device-enforced timed reversion or qualified local enforcement; host-failure scenario |
| Packed consumer | action package installed with act-core and edge-sunspec; no raw register API exposed |

### 16.3 Physical device evidence

Per claimed profile: exact device/firmware/module and binding mode; decoded
observations checked against an independent reference; supported/unsupported point
inventory; disconnect/reconnect and restart behaviour; control acceptance,
readback, timed reversion and uncertain-outcome behaviour where controls are
claimed; commit, catalogue/profile digests, operator/test date and support owner.

Monitoring qualification never implies control qualification. Claiming a
cross-vendor hardware profile requires evidence from at least two manufacturers.

## 17. Implementation sequence

| Phase | Work | Exit |
|---|---|---|
| P0 | confirm RFC number; pin baseline/specs/models; licence review; approve API; catalogue generator/manifest | reproducible catalogue, reviewed layouts, compile-checked API, licence provenance |
| P1 | discovery, P1 codecs/projections, snapshots, scheduler/poller, packages, consumer gates | read-only suites pass; limitations published; `rc` release at `next` |
| P2a | models 120–122, 160, 701/702 | DER AC observations and read-only hardware pilot |
| P2b | models 123 read-only, 124, 713, 802 | storage/battery observations; replayable evidence |
| P3 | model 123 controlled active-power limit via `act-sunspec` | FC16 sidecar proof, binding/effects/reconciliation/reversion and hardware control gates |
| P4 | selected 124/704 functions; expanded vendors/transports | per-function qualification and support records |

P1 ships without waiting for P3. Do not infer `v1` readiness from adding a
standard.

## 18. Repository integration and release

- Both packages start at `rc` and publish at `next`; promotion requires the full
  v1 gate set for their maturity (typecheck, lint, test, pack, integration,
  conformance, consumer; recovery N/A only with an owned, reasoned record).
- Add qualification-registry entries per package (this is enforced by the v1
  gate), package scripts (`test:integration`, `test:conformance`, `test:consumer`
  where owned), and dedicated CI jobs for simulator, sidecar and packed consumers.
- Update `SDK_MANIFEST.json` exports/dependencies, regenerate `docs/maturity.md`,
  and refresh the MCP symbol index. Add a SunSpec **monitoring** recipe only; no
  control tool is exposed to MCP.
- Release order: `edge-sunspec` first (`next`), then `act-sunspec` (`next`).
  `edge-modbus` is unchanged and is not republished unless a shared primitive is
  added. `check-upstream-published` must pass before either tag is cut.
- Publish additive versions under the repository version policy; new packages are
  `0.1.0` at `next`.

## 19. Fixed decisions and open items

Fixed:

- SunSpec lives in two packages: `edge-sunspec` (Sense) and `act-sunspec` (Act).
- `edge-modbus` root API, PDU contract and sidecar protocol remain compatible.
- Read-only support ships independently of controls.
- Exact model definitions and device profiles are versioned and reviewed.
- Controls use only the existing runtime, mandates, effects and durable lifecycle.
- Device/map changes invalidate prepared commands.
- No automatic write retry and no unqualified fallback protocol.
- Native signatures, measurement assurance, transport security and gateway
  evidence remain separately described.

P0 must resolve and record: adopted specification editions; exact first hardware
SKUs/modules; supported compiler structures; polling/link budgets; numeric and
canonicalization implementation; evidence retention/leaf budget defaults; model
definition licence decision; and the owner of each qualification profile.

## 20. Acceptance checklist

- [ ] RFC number confirmed and generated index updated.
- [ ] Model-definition licence reviewed; manifest, attribution and generator committed.
- [ ] Discovery distinguishes absent, incomplete, invalid and unsupported maps.
- [ ] Exact quantities and per-type unavailable values tested independently.
- [ ] uint32 sign-flip, 64-bit counters and scale-factor sentinel vectors pass.
- [ ] P1 projections retain direction, phase, source and quality.
- [ ] A binding-scoped scheduler prevents overlap with pollers and the sensor bridge.
- [ ] Descriptor changes invalidate caches and pending writes.
- [ ] Evidence batches respect WOTS leaf, storage byte and retention budgets.
- [ ] Evidence replay reproduces decoding from retained source bytes.
- [ ] Read-only package imports without act-core/proof/signer present.
- [ ] Existing Modbus API, sidecar and consumer checks still pass.
- [ ] Each enabled control binds target, encoded command, profile and effects; WMax basis is explicit.
- [ ] FC16 sidecar evidence exists before any control ships.
- [ ] Protocol acknowledgement is distinct from configuration and physical confirmation.
- [ ] Timed reversion is device-enforced or locally qualified; host failure is tested.
- [ ] Uncertain operations survive restart without blind redispatch.
- [ ] Hardware/profile claims match recorded evidence.
- [ ] No certification, site-export or settlement claim exceeds implemented evidence.

## 21. References

Repository (baseline as in the header; resolve exact links at P0):

- R1 `packages/edge-modbus/README.md`
- R2 `packages/edge-modbus/src/gateway.ts`
- R3 `packages/edge-modbus/src/sensor-bridge.ts`
- R4 `packages/edge-modbus/package.json` (exports/scripts)
- R5 `packages/act-core/src/edge-adapter.ts` and physical-effects policy
- R6 `docs/rfc/RFC-074-EDGE-TRANSPORT-QUALIFICATION-AND-FAIL-CLOSED-GATES.md`
- R7 RFC-022 prepared commands; RFC-023 physical effects

Primary sources (pin exact editions/dates in P0):

- S1 SunSpec specifications — <https://sunspec.org/specifications/>
- S2 SunSpec Device Information Model Specification (adopted edition recorded in P0)
- S3 SunSpec model definitions — <https://github.com/sunspec/models> (commit pinned in P0)
- S4 SunSpec reference implementation — <https://github.com/sunspec/pysunspec2> (commit pinned in P0)
- S5 SunSpec reference Modbus type handling (same repository, pinned commit)
- S6 Model-definition licence and attribution (record in the catalogue manifest)
- S7 Model 123 active-power controls; model 124 storage (adopted edition)
- S8 Model 701 AC measurements; model 704 AC controls
- S9 Model 713 storage capacity; model 802 battery
- S10 Model 801 deprecation notice
- S11 GoodWe published SunSpec certificate for named grid-tied models
- S12 Modbus Organization specifications, including Modbus Security — <https://modbus.org/specs.php>
