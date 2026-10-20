# RFC-056 — Entity Projection and Operational Resolution

Status: Draft — P0-A…P0-E and P1 landed; `@totemsdk/entity@0.1.0` implemented and published
Created: 2026-10-20
Authors: Totem SDK Contributors
Depends on: identity/claims (`@totemsdk/identity`), RFC-037 (Unified WOTS Signatures); references `@totemsdk/manifest`, `@totemsdk/root-identity`, `@totemsdk/authority`
Touches: **new** `@totemsdk/entity`; references `identity`, `root-identity`, `manifest`, `authority`, `governance`, `proofgraph`

> **Numbering note.** The proposal circulated as “RFC-033”, which collides with
> `RFC-033-GO-WOTS-VIA-RUST-FFI.md`. It is tracked as **RFC-056**.
>
> **Naming note.** The package is **`@totemsdk/entity`**, not
> `@totemsdk/entity-view`. A *projection* is one disclosure-bounded output; an
> *entity* is the resolved actor. The package owns resolution as well as
> projection.

---

## 1. Summary

Totem identity is already a graph: a root address, a controller, delegated
addresses, claims, manifests, governance mandates and proofs. Consumers repeatedly
need the same question answered:

> “What can I know about this actor, at this time, for this purpose — and what am I
> allowed to disclose about it?”

Today each caller re-implements part of the answer. `@totemsdk/entity` provides a
pure, local-first resolution and projection layer:

- `resolveEntity(sources, options)` — verify and compose identity, manifest,
  ownership proof and authority inputs into one resolution with explicit
  `known` / `unknown` / `invalid` states.
- `projectEntity(resolution, request)` — produce a **disclosure-bounded** view
  (minimal, available or purpose-bound) without inventing or leaking data.

It never fetches the network, never signs, never grants authority and never
performs money movement.

---

## 2. Principles (normative)

### 2.1 Absence of disclosure means unknown, not invalid

> `unknown != false` · `undisclosed != unauthorized` · `unproven != disproven`

A resolver projects only what its configured sources provide. It MUST NOT require
completeness, infer undisclosed attributes, or treat the absence of an optional
record as invalidity. Missing data is reported as `unknown`; failed verification is
reported as `invalid`; neither is collapsed into `false`.

### 2.2 Root identity is the privacy floor

Disclosure is layered and optional. A legitimate minimal interaction may disclose
only the root identity:

| Level | Meaning | Section |
|---|---|---|
| 0 | “same cryptographic actor” | `root` |
| 1 | “these addresses share a root” | `children` |
| 2 | semantic Totem identity (person/device/agent/organization/service) | `identity` |
| 3 | “I provide these capabilities” | `manifest` |
| 4 | “I possess X / own Y / satisfy Z” | `claims` |
| 5 | “I may perform Q” | `authority` |

Levels are optional and cumulative only by policy, never by requirement.

### 2.3 Projection modes

| Mode | Behaviour |
|---|---|
| `minimal` | root only (level 0); no status about other sections |
| `available` | every verified section up to `maxDisclosureLevel` (default 5) |
| `purpose-bound` | only sections required by the requested purposes; root is always included |

`purpose-bound` requires at least one purpose. Purposes map to sections:

| Purpose | Sections |
|---|---|
| `same-actor` | `root` |
| `shared-root` | `children` |
| `identity` | `identity` |
| `capabilities` | `manifest` |
| `claims` | `claims` |
| `authority` | `authority` |

### 2.4 Pseudonymity

A persistent root address can become linkable if reused publicly. The
privacy-preserving pattern keeps the root private and uses children per context,
disclosing a root-membership proof only when linking contexts is required. Root
ancestry SHOULD be selectively disclosed, not globally projected by default.

### 2.5 Root ancestry is evidence, not authority

A root-identity proof proves membership. It MUST NOT grant `manifest:sign`,
authority, governance or any other capability. Writer/authority decisions belong
to `identity`, `authority` and the application’s governance policy.

---

## 3. P0 hardening already landed

The audit `docs/audits/entity-projection-p0-2026-10.md` tracks the prerequisites.
The code has landed; the audit’s “pending” markers for P0-E are stale.

| Item | Status | Where |
|---|---|---|
| P0-A explicit resolution time (`asOf`) | landed (`ff41de95`) | `packages/identity/src/resolver.ts`, `manifest-binding.ts` |
| P0-B root-binding verifier | landed (`ff41de95`) | `packages/root-identity/src/verifier.ts` |
| P0-C governance → authority principal | landed (`e75fe7f7`) | `packages/governance`, `packages/authority` |
| P0-D industrial context freshness | landed (`e75fe7f7`) | `packages/industrial-action` |
| P0-E content-addressed manifest revisions | landed (`561239c5`) | `packages/manifest/src/id.ts`, `packages/proofgraph` |

These are prerequisites, not part of the entity package. `@totemsdk/entity`
consumes them.

---

## 4. P1 — `@totemsdk/entity` v0.1.0

### 4.1 Boundary

- Pure, local-first, no network, no DHT, no chain submission.
- Runtime dependencies: `@totemsdk/core`, `@totemsdk/identity`,
  `@totemsdk/manifest`.
- Does **not** import `root-identity` (wallet/WASM), `authority`, `governance` or
  `proofgraph` at runtime. Root proofs are verified through an injected
  `IdentityProofVerifier`; authority grants are accepted only after the
  `authority` layer has verified them.
- No signing, key management, money movement or policy evaluation.

### 4.2 Sources

```ts
export interface EntitySources {
  /** Required: the actor’s identity graph. */
  identity: IdentityGraph;
  /** Optional: a signed manifest to bind to the identity. */
  manifest?: SignedManifest;
  /** Optional: serialized OwnershipProof; verified with `proofVerifier`. */
  rootIdentityProof?: string;
  /** Optional: grants already verified by @totemsdk/authority. */
  authority?: EntityAuthorityGrant[];
}

export interface EntityResolverOptions {
  /** Explicit resolution time. Defaults to Date.now(). */
  asOf?: number;
  /** Injected root-identity verifier (from @totemsdk/root-identity). */
  proofVerifier?: IdentityProofVerifier;
}
```

`EntityAuthorityGrant` MUST carry `verified: true` and
`verifiedBy: 'authority'`. The entity package enforces time bounds and subject
matching; it does not re-verify the mandate.

### 4.3 Resolution

```ts
export interface EntityResolution {
  version: 'entity-resolution/v1';
  asOf: number;
  entityId: string;
  rootAddress: string;
  resolved: ResolvedIdentity | null;
  children: EntityChildProofView | null;
  manifest: { signed: SignedManifest; binding: ManifestIdentityBinding } | null;
  authority: EntityAuthorityGrant[];
  status: Record<EntitySection, EntitySectionState>;
  errors: string[];
}
```

`resolveEntity()` performs, in order:

1. Structural validation of the identity graph (fail closed).
2. `resolveIdentityGraph(identity, { asOf })`; revoked identities are `invalid`,
   not silently dropped.
3. Root-proof verification when `rootIdentityProof` + `proofVerifier` are present.
   The expected root MUST match `document.rootAddress`.
4. Manifest binding via `verifyManifestIdentity(..., { asOf })`. Invalid
   signatures, future/expired manifests and unauthorised signers are `invalid`.
   Root-proven children are evidence only.
5. Authority-grant filtering by `verified`, subject and `asOf`.
6. Section status assignment:

| Section | `known` | `unknown` | `invalid` |
|---|---|---|---|
| `root` | document present | — | malformed document (throws) |
| `children` | proof verified, or manifest binding proved addresses | no proof supplied | proof supplied but rejected |
| `identity` | resolved and active/rotated | — | revoked or unresolvable |
| `manifest` | binding valid | no manifest supplied | manifest supplied but binding failed |
| `claims` | at least one verified claim | no claims supplied | claims present but none verified |
| `authority` | at least one valid grant | no grants supplied | grants supplied but none valid |

### 4.4 Projection

```ts
export interface EntityProjectionRequest {
  mode?: EntityProjectionMode;                 // default 'minimal'
  maxDisclosureLevel?: EntityDisclosureLevel;  // default 0/5 depending on mode
  purposes?: EntityPurpose[];                  // required for purpose-bound
  includeMetadata?: string[];                  // identity document metadata keys
}

export interface EntityView {
  version: 'entity-view/v1';
  mode: EntityProjectionMode;
  asOf: number;
  disclosureLevel: EntityDisclosureLevel;
  root: { rootAddress: string; entityRef: string };
  status: Partial<Record<EntitySection, EntitySectionState>>;
  disclosed: EntitySection[];
  withheld: EntitySection[];
  unknown: EntitySection[];
  invalid: EntitySection[];
  children?: EntityChildProofView;
  identity?: EntityIdentityView;
  manifest?: EntityManifestView;
  claims?: EntityClaimsView;
  authority?: EntityAuthorityGrant[];
  digest: string;
}
```

Rules:

1. `root` is always disclosed and MUST be `known`.
2. Only sections in the effective request are evaluated. Sections excluded by
   mode/level/purpose are listed in `withheld`; no content or existence signal is
   emitted for them.
3. A section is disclosed only when its status is `known`. `unknown` and `invalid`
   are reported by name, never with a fabricated value.
4. `includeMetadata` is an allow-list. Metadata keys not listed are omitted.
   Omitting `includeMetadata` omits document metadata entirely.
5. `entityRef` is an opaque, domain-separated digest of the root address. It lets
   a counterparty correlate a view without exposing semantic identity.
6. `digest` is the canonical digest of the view excluding `digest` itself.

### 4.5 Canonical digests

```
entityRef(root)   = '0x' || sha3_256('entity:ref:v1'  || canonicalJson(root))
viewDigest(view)  = '0x' || sha3_256('entity:view:v1' || canonicalJson(stripUndefined(view \ digest)))
```

`undefined` optional fields are stripped recursively so absence and explicit
`undefined` produce the same digest.

### 4.6 Validation (fail closed)

`EntityValidationError` lists issues. Resolution/projection MUST reject:

- a missing/malformed identity document (id, root, controller, kind);
- invalid `asOf` (non-safe-integer, negative) or a projection `asOf` that differs
  from the resolution;
- unknown modes, levels outside `0…5`, or unknown purposes;
- `purpose-bound` with no purposes;
- authority grants that are not `verified: true` / `verifiedBy: 'authority'`,
  have invalid subject or time bounds — these are reported as `invalid`, not
  thrown, because their absence is not a failure of the entity.

### 4.7 Explicitly out of scope

- Network resolution, DHT lookup, caching or persistence.
- Signing, key custody, WOTS lease management.
- Authority/mandate verification (accepts only pre-verified grants).
- Governance voting or policy evaluation.
- Any claim that a projected view is complete.
- On-chain anchoring (proofgraph/Minima remain separate).

---

## 5. Consumers and package coverage

P1 introduces the package; no existing package is required to change. The matrix
below classifies every publishable package so future integrations are explicit
rather than assumed.

### 5.1 Integration matrix

| Consumer | Use | Priority |
|---|---|---|
| `edge` + `connect` + `wallet-adapter` | minimum counterparty identity before an action; origin/approval context | High |
| `industrial-action` + `edge-*` connectors (`edge-adapters`, `edge-bacnet`, `edge-ble`, `edge-can`, `edge-coap`, `edge-email`, `edge-grpc`, `edge-lorawan`, `edge-matter`, `edge-modbus`, `edge-nfc`, `edge-opcua`, `edge-ros2`) | purpose-bound device identity and capability disclosure; connectors remain producers | High |
| `authority` + `governance` | resolve the principal and attached grants at an explicit `asOf` | High |
| `identity` + `root-identity` + `manifest` | source layers: resolve claims, verify root proofs, bind manifests | High (sources) |
| `lookup-client` + `lookup-node` + `lookup-protocol` + `manifest` | disclose a service’s root + capabilities without its claims; carry `entityRef` in announcements | High |
| `proofgraph` + `proof` + `proof-integritas` | attach a stable, privacy-bounded `entityRef` to evidence and proofs; root proofs as artifacts | High/Medium |
| `decision` + `agent-policy` | resolve the agent/principal and grants for autonomy and decision receipts | Medium |
| `eefi` | resolve counterparties and authorised roles without linking identities | Medium |
| `omnia` family (`omnia`, `omnia-factory`, `omnia-host`, `omnia-pool`, `omnia-router`, `omnia-splice`, `omnia-vtxo`, `omnia-relay`) | resolve channel/factory counterparties at `asOf`; corroborate `transportPubkey` binding | Medium/Selective |
| `provider-bond` + `liquidity-bond` | resolve bond counterparties and roles | Medium/Selective |
| `server` + `se-server` | resolve requester/operator identity in settlement/statechain flows | Selective |
| `qvac` + `intelligence` | resolve agent/service identity for capability manifests | Selective |
| `location-proof` + `spatial-proof` + `raster-proof` | attach `entityRef` to evidence (via proofgraph) | Selective |

### 5.2 Explicit non-integrations

These packages do not need the entity layer, or use it only through another
package:

- **`core`, `core-wasm`, `kissvm`, `tx-builder`, `minima-rpc`, `txpow`,
  `recursive-mast`, `wots-lease`**: validity, execution, schema or key-use
  coordination only; no identity projection.
- **`storage`**: entity views are derived data. Persistence/caching is a caller
  concern (for example through `proofgraph` or an application store), not an
  entity-package feature.
- **`pear`, `stream-transport`, `pubsub-transport`, `realtime`, `chain-provider`**:
  runtime/transport/indirect consumers. They may carry projections but do not
  resolve entities themselves.
- **`edge-mqtt`**: transport metadata only; device identity belongs to
  `industrial-action`/`edge`.
- **`mcp-server`**: documentation/index metadata only.

No existing package MUST change for P1. The first integration should be a
consumer that already handles a counterparty at an explicit time (lookup,
authority/governance, or industrial-action), not the payment or custody layers.

---

## 6. Security considerations

- **Linkability:** a root address is a long-lived identifier. Prefer per-context
  children and level-1 membership proofs when correlation is not required.
- **Revocation:** revocation is evaluated at `asOf`; a previously disclosed view
  cannot be un-disclosed.
- **Replay/time:** projections carry `asOf`; consumers must reject views older
  than their policy allows.
- **Metadata:** free-form identity metadata is an explicit allow-list because it
  can contain PII.
- **Authority:** a grant in an entity view is evidence of what `authority`
  verified, not a capability check. Execution layers MUST re-verify at use time.
- **Fail closed:** invalid manifests and malformed documents never fall back to
  raw data.

---

## 7. Conformance

Package tests MUST cover:

1. minimal view contains root only and no identity/manifest/claims/authority
   fields or status;
2. `available` discloses verified sections and reports others as `unknown`;
3. `purpose-bound` with `capabilities` discloses root + manifest only;
4. `purpose-bound` with `authority` discloses root + authority only;
5. metadata allow-list omits unlisted keys;
6. expired/revoked/unauthorised claims are excluded at `asOf`;
7. invalid manifest binding yields `invalid`, never raw parsed data;
8. unknown authority grant is `unknown`, invalid grant is `invalid`;
9. view digest is deterministic and key-order independent;
10. `unknown`, `undisclosed` and `false` are never conflated.

The package is registered in `scripts/workspace-gates.config.json`,
`SDK_MANIFEST.json` (domain `identity`) and the MCP symbol index.

---

## 8. Open questions

1. Should `resolveEntity` accept a pre-resolved `ResolvedIdentity` to avoid
   re-verifying large graphs? (v1: no.)
2. Should `entityRef` commit the `asOf` or be stable across time? (v1: stable.)
3. Do we need a `purpose` registry backed by policy, or is the fixed mapping in
   §2.3 sufficient? (v1: fixed mapping.)
4. Should level-4 claims expose raw signed claims for independent verification, or
   only the resolver’s typed summary? (v1: typed summary; raw claims stay in the
   identity graph.)
5. How should an entity view reference a manifest revision (P0-E) without
   disclosing the full manifest? (future.)

---

## 9. Authorisation

This RFC authorises `@totemsdk/entity` v0.1.0: the resolution/projection types,
`resolveEntity()`, `projectEntity()`, canonical view digests, fail-closed
validation and tests. It authorises no network, signing, custody or authority
implementation. P0 items remain owned by their existing packages.
