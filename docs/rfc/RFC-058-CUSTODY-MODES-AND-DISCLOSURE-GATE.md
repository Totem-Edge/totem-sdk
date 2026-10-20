# RFC-058 — Custody Modes, Non-Custodial Defaults, and the Liquidity Commitment Disclosure Gate

**Status:** Draft — **P0 priority**; Amendment A (custodial completeness gate) added 2026-10-20
**Priority:** P0
**Created:** 2026-10-20
**Authors:** Totem SDK Contributors
**Depends on:** RFC-039 (Custody Conformance), RFC-038 (VTXO Operator), RFC-035 (Omnia Peer Coordination), RFC-037 (Unified WOTS Signatures), RFC-013 (Wallet Self-Hosted Mode), RFC-014 (Wallet Connect Parity), RFC-048 (Omnia Primitive Completeness)
**Touches:** `omnia`, `omnia-host`, `omnia-factory`, `omnia-vtxo`, `omnia-pool`, `omnia-splice`, `omnia-router`, `omnia-relay`, `wallet-adapter`, `manifest`/`identity`, `extensions/totem-extension`, custody policy and gates

> **Positioning.** Omnia must serve two markets with one protocol: self-custody
> builders (the default) and operators that explicitly choose hosted custody. The
> SDK must never silently become custodial, and a hosted deployment must not be able
> to present itself as self-custody. This RFC defines the custody-mode boundary, the
> signing abstraction that makes it enforceable, and the Totem extension gate that
> requires an explicit custody/risk disclosure before a user signs any liquidity
> commitment.
>
> **Amendment A (2026-10-20) — custodial completeness gate.** A pre-implementation
> audit (§5.0) found that **custodial plumbing is not complete**: the host signs
> directly (no `SignerPort`), there is no KMS/HSM/MPC or policy engine, VTXO/pool
> host methods are absent, unilateral-close/dispute methods are absent, several
> stores are in-memory, the disclosure gate does not exist, and live on-chain
> execution is blocked by the missing Minima node on the test hosts. Therefore
> **non-custodial implementation work is gated behind the P0 custodial checklist**
> in §5.0. Shared foundations (`SignRequest`/`SignerPort`, custody schema, disclosure
> hash) may land first because both modes depend on them. The protocol default
> remains non-custodial; the *implementation order* is custodial-first to de-risk the
> shared signing/policy/state plumbing.

---

## 1. Summary

This RFC decides:

1. **Non-custodial is the default.** The host is a signer-less coordinator unless a
   deployment explicitly opts into `custody: hosted`.
2. **Hosted custody is an explicit, policy-controlled deployment mode**, not a
   default package behaviour. It is never enabled implicitly and never marketed as
   self-custody.
3. **Signing is a port.** Every mutation is prepared as a `SignRequest`; a
   `SignerPort` (wallet, KMS/HSM/MPC, or hosted policy engine) signs it. The host has
   no key unless configured.
4. **Every liquidity commitment carries a signed custody disclosure.** The
   commitment signature is domain-separated with the disclosure hash, so a signature
   is invalid under different terms.
5. **The Totem extension hard-gates hosted liquidity commitments.** Before signing,
   it shows a blocking custody/risk disclosure and requires explicit
   acknowledgement. A missing or spoofed custody block fails closed. All signing
   paths are covered.
6. **The package-level custody gate in RFC-039 is unchanged.** No publishable
   value-bearing package becomes custodial. Hosted custody is a **deployment
   composition** (operator-supplied signer/policy adapter), gated by a new
   deployment-custody policy.
7. **Custodial plumbing is a prerequisite.** The P0 checklist in §5.0 must be
   complete (or explicitly waived) before non-custodial implementation starts.

---

## 2. Motivation

### 2.1 Builders need both models

- **Self-custody builders** (edge nodes, merchants, wallets, DAOs) need user-held
  keys, user-signed allocations and unilateral exit.
- **Hosted-custody builders** (operators, LSPs, custodial wallets, regulated
  venues) need policy-controlled signing, recovery, approvals and audit.

Forcing one model on both loses either safety or usability.

### 2.2 The current host silently signs

`omnia-host` derives a signer from `OMNIA_HOST_SEED` (`signing.ts`) and signs
channel/factory/splice/VC mutations in `methods.ts`. There is no machine-readable
custody claim in the request, no extension warning, and no way for a user to tell a
self-custody deployment from a hosted one. That is unacceptable for a product that
wants both.

### 2.3 The extension is the last line of defence

A dApp can hide or misrepresent custody. The extension sees the signing request at
the point of authorization and must be the enforcement point. A warning that the
dApp can suppress is not a control.

### 2.4 Regulatory and liability boundary

Non-custodial defaults reduce the custody/investment surface. Hosted custody is a
regulated activity in many jurisdictions, and public yield advertising can turn a
protocol into an investment offering. The disclosure gate gives users facts and
gives operators a clear, signed liability boundary. This RFC is technical design,
not legal advice.

---

## 3. Goals and non-goals

**Goals**

- **Complete the custodial plumbing first** (§5.0) so the shared signer/policy/state
  boundary is proven before non-custodial split APIs are built.
- Make self-custody the default across all Omnia packages and the host.
- Retain a first-class, explicit hosted-custody integration path.
- Enforce custody disclosure at the signing boundary, including dApp/WalletConnect
  requests.
- Bind acknowledgements and signatures to the exact disclosure/terms.
- Keep RFC-039's package gate intact.
- Define a migration path for existing seed-based hosts.

**Non-goals**

- Shipping a custodial key-management implementation inside the default SDK.
- Legal classification of any deployment.
- Changing the on-chain custody script rules in RFC-039.
- A general-purpose consent framework; this is scoped to liquidity commitments.

---

## 4. Definitions

- **Liquidity commitment** — a signature that puts capital at risk or restricts its
  withdrawal, including: channel open/funding, factory funding, splice-in, VTXO
  mint/deposit, pool deposit/allocate, and the purchase of any position/receipt
  representing such capital. Ordinary payments are out of scope for this gate,
  though hosted wallets may reuse the disclosure UX.
- **Self-custody (`custody.mode = 'self'`)** — the user holds the keys; no third
  party can move, freeze, or block the user's funds; a unilateral exit exists.
- **Hosted custody (`custody.mode = 'hosted'`)** — an operator holds or controls
  keys/co-signing, or has discretionary allocation/freeze power; recovery depends on
  that operator.
- **Trust-minimised** — an operator can affect liveness (delay/censor) but cannot
  steal; a unilateral exit exists (RFC-039).
- **Disclosure hash** — domain-separated hash of the operator's custody/risk terms,
  policy summary, jurisdiction and material facts, included in the signed
  commitment.

---

## 5. Decisions

### D0 — Custodial completeness before non-custodial implementation

Custodial plumbing is the higher-risk path and exercises the same `SignRequest` /
`SignerPort` boundary that non-custodial mode needs. It must be complete, audited,
and live-tested before non-custodial implementation begins.

#### 5.0 Custodial plumbing completeness audit (2026-10-20)

“Custodial plumbing” here means the **hosted deployment capabilities**: operator-held
signing/policy, recovery/dispute paths, durable state, host APIs, disclosure and
the extension gate. It does **not** mean shipping a custodial package (RFC-039
remains hard-fail).

| Area | Current state | Status | Blocks non-custodial? |
|---|---|---|---|
| `SignRequest` / `SignerPort` | Host signs directly from `OMNIA_HOST_SEED`; no port abstraction | ❌ missing | Yes — shared foundation |
| KMS/HSM/MPC + policy engine | None; no limits, allowlists, quorum, dual control, audit | ❌ missing | Yes |
| Channel lifecycle (S4) | open/pay/settle/close live-tested | ✅ | — |
| Unilateral close / recovery | SDK has `start/finalizeUnilateralClose`; no host methods | ❌ missing | Yes |
| Factory funding/close (S5) | Two-party funding + cooperative close coded/unit-tested; live chain blocked (no node) | 🟡 partial | Yes — live E2E |
| Virtual channels (S5) | open/close live-tested | ✅ | — |
| Splice (S7) | Host coordination wired/unit-tested; live on-chain and funding-coin path blocked | 🟡 partial | Yes — live E2E |
| VTXO host methods (S6) | SDK harness green; no host context/stores/operator/methods | ❌ missing | Yes |
| Pool host methods (S10) | SDK harness green; no registry/positions/ports/methods | ❌ missing | Yes |
| Router / multi-hop (S8) | Fee-aware SDK green; three-host E2E blocked | 🟡 partial | No — but required for hosted liquidity |
| Relay (S9) | Local relay round-trip green | ✅ | — |
| Durable stores / audit | Channels SQLite; factory/splice proposals in memory; no audit/reconciliation | ❌ partial | Yes |
| Custody disclosure in manifest/SignRequest | Not implemented | ❌ missing | Yes |
| Totem extension gate | Not implemented | ❌ missing | Yes |
| Deployment custody policy / CI | Not implemented | ❌ missing | Yes |
| Live E2E environment | Minima node/binary absent on A/B; only Omnia host + DHT seed running | ❌ blocked | Yes — live E2E |

**Gate rule.** Non-custodial implementation PRs do not start until every P0 row is
✅ or has a written waiver approved in this RFC. Shared foundations (D3 schema,
`SignerPort`, disclosure hash) may land first because both modes need them. The
custodial adapter, VTXO/pool host methods, durable stores, dispute/recovery paths,
extension gate and live S5/S7/S8 runs are P0.

### D1 — Non-custodial default

`custody.mode` defaults to `'self'`. A host started without an explicit signer is a
**coordinator**: it builds `SignRequest`s, relays, aggregates signatures and
broadcasts. It does not sign, and it never substitutes its own key for a missing
user signature.

### D2 — Hosted custody is opt-in and policy-controlled

`custody.mode = 'hosted'` requires:

- an explicit operator identity/legal entity and jurisdiction;
- a signed disclosure (hash + version + URL);
- a policy engine (limits, approvals, allowlists/quorum, audit);
- the extension gate in §8;
- exclusion from default bundles and default examples;
- a compliance wrapper chosen by the operator.

Hosted mode is never inferred from a seed being present. A seed-based host must
declare `hosted` explicitly.

### D3 — Signing is a port

```ts
interface SignerPort {
  readonly publicKeyDigest: string;
  sign(request: SignRequest): Promise<Uint8Array>;
}

interface SignRequest {
  requestId: string;                 // idempotency key
  domain: 'channel' | 'factory' | 'settlement' | 'splice' | 'vtxo' | 'pool';
  digest: Uint8Array;                // exact bytes to sign
  context: SignContext;              // human-readable intent
  signers: string[];                 // required public key digests
  custody: CustodyContext;           // §6
  expiresAt: number;
  chainId?: string;
}

interface SignContext {
  summary: string;                   // "Open channel: 100 MIN, counterparty A…"
  asset: string;
  amount: string;
  terms: string;                     // lockup/withdrawal/exit
  warnings?: string[];
}
```

- SDK mutations expose `prepare*` → `sign*` → `submit*` (or return a `SignRequest`
  when no signer is supplied).
- Existing `build`/`sign`/`assemble` flows (factory, VC, splice, settlement) are the
  reference implementation.
- Multi-party signing uses peer messages: `SIGN_REQUEST` / `SIGN_RESPONSE`, with
  request-id deduplication, expiry and replay protection.

### D4 — Custody metadata and disclosure binding

Every liquidity commitment's `SignRequest.custody` contains at least:

```ts
interface CustodyContext {
  mode: 'self' | 'hosted';
  operatorId?: string;
  legalEntity?: string;
  jurisdiction?: string;
  license?: string;
  keyManagement: 'wallet' | 'kms' | 'hsm' | 'mpc' | 'host';
  canMoveFunds: boolean;
  canFreeze: boolean;
  operatorDiscretion: boolean;
  withdrawalTerms: string;
  receiptTransferability: 'none' | 'restricted' | 'transferable';
  disclosureHash: string;
  disclosureVersion: string;
  policySummary: string;
}
```

The signature is domain-separated with `disclosureHash`; the host/contract verifies
it. A signature produced under disclosure A cannot be replayed under disclosure B.

### D5 — Extension hard gate

The Totem extension **must refuse to sign a hosted liquidity commitment** until the
user has explicitly acknowledged the disclosure (§8). Missing `custody` metadata on
a liquidity commitment fails closed. The gate applies to every signing path.

### D6 — Pool/VTXO defaults

- Per-position ownership and user-signed allocations are the default.
- Non-transferable receipts are the default; transferable/omnibus receipts are
  hosted-only.
- VTXO operators are optional; if present they attest/co-sign but cannot spend, and
  a unilateral, timelocked exit exists.
- No pooled return and no public yield advertising in the non-custodial default.

### D7 — Immutable/permissionless defaults

Immutable scripts, no admin/proxy/upgrade keys by default; versioned opt-in
migration. Hosted deployments may add policy controls, but they are labelled
custodial and are not the default.

### D8 — Policy amendment, not a package exception

RFC-039 remains: no publishable value-bearing package may be `custodial`. This RFC
adds a **deployment-level** custody policy and gate (D2), because hosted custody is
a composition of non-custodial primitives with an operator signer/policy adapter,
not a new SDK capability claim. If a hosted adapter is published as a package, it
requires a separate, explicit policy exception and cannot be part of default
bundles.

---

## 6. Custody modes

| Mode | Key holder | Can move/freeze? | Default | Extension gate | Regulatory posture |
|---|---|---|---|---|---|
| `self` | User wallet / self-hosted host | No third party | ✅ | Self-custody badge/confirmation | Lower custody surface |
| `trust-minimised` | User key + co-signer | Can delay/censor, not steal | Opt-in | Show liveness/exit terms | Labelled; RFC-039 |
| `hosted` | Operator (KMS/HSM/MPC/policy) | Yes, per policy | ❌ explicit only | **Blocking disclosure + acknowledgement** | Likely regulated; operator owns compliance |

A deployment must declare its mode in the signed manifest. The extension derives
the mode from that manifest, not from the dApp UI.

---

## 7. Package impact

| Package | Non-custodial default | Hosted mode retained |
|---|---|---|
| `core` | `SignRequest`/`SignerPort` types, domain separation | same |
| `omnia` | Prepare/sign/submit channel, settlement, HTLC; peer `SIGN_REQUEST`/`SIGN_RESPONSE`; user-held leases | `SignerPort` backed by operator KMS/HSM |
| `omnia-factory` | User-signed funding and cooperative close; existing build/sign/assemble | Operator bundles/policy |
| `omnia-vtxo` | User-held operator/attestation; non-transferable receipts; unilateral exit | Operator-held VTXO keys/exit |
| `omnia-pool` | Per-position ownership; user-signed allocations; direct payouts; no pooled NAV | Omnibus registry, operator allocation, transferable receipts |
| `omnia-splice` | build/propose/accept/finalize via `SignerPort` | Operator signing |
| `omnia-router` | Routes only within user-signed capacity; per-position fees | Operator-directed liquidity |
| `omnia-relay` | Transport only; custody-agnostic | same |
| `omnia-host` | Signer-less coordinator; wallet bridge; public-state store | Hosted signer adapter + policy engine |
| `wallet-adapter` | User-held keys; custody metadata passthrough | Delegated signing policy |
| `manifest`/`identity` | Publish `custody` + disclosure hash/version | same |
| `totem-extension` | Self-custody confirmation; hosted disclosure gate | Enforcement point |

Existing `build`/`sign`/`assemble` functions become the internal shape of
`prepare`/`sign`/`submit`; no new custody primitive is introduced.

---

## 8. Totem extension disclosure gate

### 8.1 Trigger

Before signing any hosted **liquidity commitment** (channel funding, factory
funding, splice-in, VTXO mint/deposit, pool deposit/allocate, receipt purchase).
Non-custodial commitments show a lighter self-custody confirmation.

### 8.2 Required content

A blocking modal (not a toast) displays:

- “You are using a **custodial operator**.”
- Operator legal entity, jurisdiction, licence/registration (or “not registered”),
  and the policy summary.
- Who holds keys; whether the operator **can move funds**, **can freeze**, or has
  **discretion**.
- The exact commitment: asset, amount, lockup/withdrawal terms, fees, exit path.
- Custody/risk: operator failure, hack, insolvency, withdrawal delays, insurance,
  segregation, dispute/redress.
- Receipt transferability and whether any quoted “yield” is variable/not guaranteed.
- A **self-custody alternative** (or a clear statement that none is available for
  this product).

### 8.3 Acknowledgement

- Explicit checkbox; for large commitments, a typed phrase and/or second
  confirmation.
- Acknowledgement is stored keyed by
  `(operatorId, legalEntity, disclosureHash, disclosureVersion)`.
- Any material change bumps the version/hash and forces re-acknowledgement.
- The signed commitment is bound to the acknowledgement (disclosure hash in the
  signed payload).
- A persistent “Custodial” badge remains for the connected site/operator.

### 8.4 Anti-bypass

- Missing `custody` block on a liquidity commitment → **fail closed**.
- dApp claims of self-custody are ignored; the signed operator manifest wins.
- Gate applies to popup, provider/dApp requests, WalletConnect/QR and background
  signing.
- The extension refuses if the disclosure hash/version is stale, unknown, or does
  not match the manifest.
- The extension never signs a hosted commitment on a “don’t show again” global
  toggle; only per-disclosure/version acknowledgements.

### 8.5 Implementation points

- `extensions/totem-extension/src/ui/components/molecules/TransactionReview.tsx`
- new `extensions/totem-extension/src/ui/components/organisms/CustodyDisclosureModal.tsx`
- `extensions/totem-extension/src/ui/popup/pages/BrutalistSend.tsx`
- `extensions/totem-extension/src/background/index.ts` (signing boundary)
- `extensions/totem-extension/src/connect` / provider request path
- `extensions/totem-extension/src/core/storage/typedStorage.ts` (ack store)
- `extensions/totem-extension/src/ui/pages/ConnectedSites.tsx` (persistent badge)

---

## 9. Operator obligations

A hosted operator must:

1. Publish a signed manifest with `custody` metadata, disclosure hash/version and
   policy summary.
2. Maintain a policy engine: withdrawal limits, destination allowlists, quorum /
   dual control, velocity limits, audit log.
3. Use KMS/HSM/MPC (or equivalent) for signing material; never plaintext seeds in a
   service.
4. Segregate customer assets where the legal structure requires it; disclose
   insurance/audit status truthfully.
5. Publish withdrawal, freeze, fee, dispute and redress terms; version them.
6. Re-publish and force re-acknowledgement on material changes.
7. Keep custody and yield marketing inside the operator's regulated wrapper; the
   non-custodial protocol default does not advertise yield.
8. Support user export/exit according to the disclosed terms and applicable law.

---

## 10. Policy and CI changes

RFC-039's package gate remains unchanged. Add:

- `docs/DEPLOYMENT-CUSTODY-POLICY.md` — definitions and obligations for `self`,
  `trust-minimised`, `hosted`.
- `scripts/validate-deployment-custody.mjs` — a deployment/manifest gate:
  - `hosted` requires operator, legal entity, jurisdiction, disclosure hash/version,
    policy summary and the extension-gate declaration;
  - `hosted` deployments are excluded from default bundles/examples;
  - a package-level `custodial` classification still hard-fails;
  - `SDK_MANIFEST.json` gains `custodyModes`/`deployments` alongside package
    `custody`.
- Extension CI tests for the gate (§12).

If a hosted signer/policy adapter is published as a package, it requires an explicit
exception in `workspace-gates.config.json` and cannot be a default dependency. The
preferred location for the reference adapter is the operator deployment
(`axia-platform`), not the default SDK.

---

## 11. Migration and backward compatibility

- Existing seed-based hosts become `custody: hosted` explicitly; they must publish a
  disclosure and pass the extension gate. This is a breaking operational change by
  design.
- The SDK keeps existing signing functions for compatibility; new `prepare*` APIs are
  additive. Hosts default to coordinator when no signer is configured.
- Manifest schema adds optional `custody`; absence is treated as unknown and fails
  closed for hosted commitments.
- Existing non-custodial deployments continue with a self-custody confirmation.
- Deprecation: seed-based default signing is removed from default examples and
  flagged in logs; a migration guide is required.

---

## 12. Test plan

**Core / SDK**

- `SignRequest` domain separation; signature under disclosure A fails under B.
- expiry, replay, request-id idempotency, refusal handling.
- prepare/sign/submit equivalence with existing build/sign/assemble flows.

**Custody modes (S4–S10 matrix)**

- Every stage runs in `self` and `hosted`: channels, factory, splice, VTXO, pool,
  router, relay.
- Hosted mode requires a signer/policy adapter and produces the same state
  transitions.
- Non-custodial default has no host key and cannot sign.

**Extension**

- hosted commitment without acknowledgement → signing refused;
- self-custody commitment → no custodial warning, self-custody confirmation;
- missing `custody` → fail closed;
- stale/changed disclosure hash/version → re-acknowledgement;
- dApp spoofs `mode: 'self'` → manifest-derived mode wins;
- large amount → second confirmation;
- all signing paths (popup, provider, WalletConnect/QR) gate identically;
- replay of a signature under a different disclosure fails;
- persistent custodial badge per connected operator.

**Policy/CI**

- `validate-custody.mjs` still hard-fails package `custodial`.
- `validate-deployment-custody.mjs` fails hosted deployments without disclosure,
  policy, operator identity or extension-gate declaration.
- Default bundles contain no hosted adapter.

---

## 13. Rollout

| Phase | Scope |
|---|---|
| **P0** | This RFC (incl. Amendment A); deployment-custody policy; schemas; extension gate spec; custodial completeness waiver/checklist |
| **P1** | Shared foundation: `SignRequest`/`SignerPort`, custody schema, disclosure hash, prepare/sign/submit primitives |
| **P2** | Custodial completeness: KMS/HSM/MPC + policy engine; VTXO/pool host methods; unilateral close/dispute methods; durable stores/audit; live S5/S7/S8 E2E; redeploy the Minima node |
| **P3** | Extension disclosure gate + anti-bypass + tests |
| **P4** | Hosted reference deployment in `axia-platform`; signed disclosures/policy; deployment-custody CI |
| **P5** | Non-custodial split APIs; per-position allocations; non-transferable receipts; signer-less coordinator host |
| **P6** | Migration, docs, default switch; protocol-only GTM |

P0 is release-blocking for any hosted deployment and for the default switch.

---

## 14. Regulatory and product notes (not legal advice)

- Non-custodial default reduces the custody/investment/payment surface but does not
  remove AML/sanctions/tax/marketing obligations.
- Hosted custody is likely a regulated activity in the UK/EU and many other markets;
  the operator owns the compliance wrapper (KYC/AML, safeguarding, disclosures,
  complaints, jurisdiction restrictions).
- Public yield advertising is a separate regulatory risk; the non-custodial default
  should lead with utility and show realized fees privately. Hosted operators may
  market under their own compliant wrapper, not the protocol brand.
- No fiat/payment leg in the core protocol; hosted/regulated partners may add one
  separately.

---

## 15. Open questions

1. Should `trust-minimised` be a first-class `custody.mode`, or a flag on `self`?
2. Where should the hosted signer/policy adapter live: `axia-platform`, a separate
   `@totemsdk/omnia-host-custody` package (with a policy exception), or builder-owned?
3. Should disclosure documents be pinned in the manifest, an on-chain registry, or
   both? How are revocations handled?
4. What is the default recovery model for self-custody (seed backup, social
   recovery, hardware wallet)?
5. Do ordinary hosted payments need the same disclosure gate, or only liquidity
   commitments?
6. What is the per-position pool UX that keeps routing liquid without an omnibus
   pool?
7. Which extensions/wallets beyond Totem must implement the gate, and can a shared
   conformance suite certify them?
8. Which §5.0 P0 rows, if any, may be waived before non-custodial work starts? The
   current proposal is **none** for signing, VTXO/pool host methods, unilateral
   recovery, disclosure/extension gate and live S5/S7.
9. Does custodial-first sequencing delay the non-custodial default unacceptably, or
   should the shared `SignerPort`/schema land in parallel while the custodial
   checklist is completed?

---

## 16. References

- `docs/CUSTODY-POLICY.md`, RFC-039 — package custody conformance.
- RFC-038 — VTXO operator protocol.
- RFC-035 — Omnia peer coordination (message/signature exchange).
- RFC-037 — unified WOTS signatures and key hierarchy.
- RFC-013/014 — wallet self-hosted / connect parity.
- RFC-048 — Omnia primitive completeness.
- `extensions/totem-extension` — signing review, provider, storage.
- `packages/omnia-host/src/signing.ts`, `lifecycle.ts`, `api/methods.ts`.
- `packages/omnia-pool/src/live-ports.ts`, `packages/omnia-vtxo/src/operator.ts`.
