# RFC-032: Lookup-Stack Post-Quantum Identity — Replace Ed25519 with WOTS/TreeKey

**Status:** Landed (TypeScript packages) — v2 hard switch implemented across `lookup-protocol`, `lookup-client`, `lookup-node`. Ed25519 removed; per-message WOTS `auth` envelope + nonce-monotonicity replay guard; registry verifies the WOTS-signed manifest; lease node identity is WOTS/TreeKey. Go mirrors (`lookup-*/go`) and generated TypeDoc are **not yet updated**. Live-key deployment should derive the identity from `@totemsdk/root-identity` and coordinate indices via `@totemsdk/wots-lease` (RFC-032 §9 Q1).
**Created:** 2026-10-02
**Authors:** Totem SDK Contributors
**Reviewers:** [Pending stakeholder assignment]
**Depends on:** RFC-008 (federated statechain / root identity), RFC-009 (TreeKey signature fidelity), RFC-013 (wallet self-hosted lease)
**Touches:** `@totemsdk/lookup-protocol`, `@totemsdk/lookup-client`, `@totemsdk/lookup-node`, `@totemsdk/wots-lease`, `@totemsdk/root-identity`, `@totemsdk/manifest`

---

## 1. Summary

The lookup stack (`lookup-protocol` / `lookup-client` / `lookup-node`) authenticates peers with **Ed25519**, which is broken by Shor's algorithm and therefore not post-quantum. Everywhere else in Totem, identity is **hash-based** (WOTS+ / TreeKey, RFC-008/RFC-009) and anchored to a Minima address; the lookup stack is the outlier.

This RFC replaces Ed25519 across the lookup stack with the **WOTS/TreeKey identity Totem already uses**, so that node authentication, app/agent announcements, lease certificates and trust records all attach a single, quantum-resistant identity to access requests. It is a **hard switch** (per decision): the lookup wire format moves to WOTS-only and Ed25519 is removed, not dual-run.

## 2. Motivation

### 2.1 The PQ gap, with evidence

Ed25519 (Shor-breakable) is used at five sites, all in the lookup stack:

| Site | Role | Evidence |
|---|---|---|
| `lookup-client/src/auth.ts` | Generates an **ephemeral Ed25519 identity**, signs the auth challenge | `generateIdentityKeyPair()`, `{ name: 'Ed25519' }` (`auth.ts:38-76`) |
| `lookup-node/src/server-auth.ts` | Verifies `AUTH_RESPONSE` | `subtle.importKey('raw', …, { name: 'Ed25519' })` (`server-auth.ts:69-82`) |
| `lookup-client/src/client.ts` | Signs `APP_ANNOUNCE` / `AGENT_ANNOUNCE` manifest bytes | `keypair.signFn(params.manifest)` (`client.ts:337, 364`) |
| `lookup-node/src/registry.ts` | Verifies announcements on ingest | `verifyEd25519(...)` (`registry.ts:30-55, 80, 156`) |
| `lookup-node/src/lease.ts` | Node-issued lease certificate signing key; the key's hash becomes `nodeId` | `subtle.generateKey({ name: 'Ed25519' }, …)` (`lease.ts:115-146`) |

`lookup-protocol/src/messages.ts:216-218,259-261` hard-codes "Hex-encoded Ed25519 public key/signature" in the wire contract, and `lookup-protocol/src/auth.ts` is algorithm-agnostic by design (`SignFn`/`VerifyFn`), so the crypto itself was always meant to be pluggable.

### 2.2 The system already has the right identity

- `@totemsdk/manifest` `SignedManifest` already carries a **WOTS signature**, `signerPublicKey` and `rootIdentityProof` (`packages/manifest/src/types.ts:127-133`), with self-contained verification via `verifyManifest` (`packages/manifest/src/verify.ts:32`).
- `@totemsdk/root-identity` (`UnifiedIdentityWallet`, `MAX_CHILD_COUNT = 64`) provides a durable root TreeKey anchored to up to 64 on-chain addresses.
- `@totemsdk/wots-lease` provides one-time key-index coordination, an append-only `LeaseJournal`, and monotonic watermarks — exactly the machinery WOTS requires to never reuse an index (`packages/wots-lease/src/index.ts`).
- `@totemsdk/core` exposes `verifyTreeSignature`, `wotsVerify`, and `TreeKey` (`packages/core/src/index.ts:83-114`).

The lookup envelope’s Ed25519 signature is a **second, redundant** identity that is "not stored in any response and never hits the chain" (`lookup-client/src/client.ts:287-290`). It adds a PQ hole without adding identity the system does not already have via the WOTS-signed manifest.

### 2.3 Why WOTS, not a separate PQ signature (ML-DSA/SPHINCS+)

Because the lookup stack must attach **a verifiable identity to access requests**, and the identity that matters is the Minima-address-anchored WOTS/TreeKey identity used everywhere else:

- A separate ML-DSA keypair would create a **parallel identity** that is not anchored to an address, not lease-managed, and not the identity a consumer trusts on-chain.
- SPHINCS+/ML-DSA are stateless and convenient but would still need a separate key-to-address binding and a second trust root.
- The WOTS/TreeKey route reuses the existing anchor (`rootIdentityProof`), the existing verifier (`verifyTreeSignature`/`verifyManifest`), and the existing one-time-key discipline (`wots-lease`).

The cost of WOTS (one-time indices, larger signatures, lease coordination) is real and is the main subject of §5.

## 3. Goals

1. Remove Ed25519 from the lookup stack; every signature is WOTS/TreeKey over SHA3-256.
2. Bind lookup identity to the **root TreeKey / Minima address** via `rootIdentityProof`, not an ephemeral keypair.
3. Make every access request **self-authenticating**: identity + proof + WOTS signature travel with the message.
4. Preserve WOTS one-time safety: no index reuse, with replay rejection at the node.
5. Hard-switch the wire format (`lookup-protocol` v2); remove the Ed25519 fields.
6. Keep verification self-contained (no network lookup required to verify a signature).

## 4. Non-goals

- Replacing Ed25519 outside the lookup stack (none found — the SDK’s consensus/payment paths are already WOTS/SHA3; WebAuthn P-256 lives in `axia-platform`, separate repo).
- A general crypto-agility framework (this is a hard switch, not a negotiation).
- Changing the lookup transport (hyperswarm/stream) or discovery.
- Re-litigating SHA-256 vs SHA3: SHA-256 under Grover is not the PQ concern (see §5.7).

## 5. Design

### 5.1 Identity model

The lookup identity **is** the root identity. There are two WOTS forms in the SDK; the RFC uses the **hierarchical TreeKey** form because it is the one bound to the root identity:

```ts
// lookup-protocol (v2)
export interface WotsIdentity {
  /** Hex of the root WOTS/TreeKey public key the signature must chain to. */
  rootPublicKey: string;
  /**
   * Hierarchical TreeSignature (RFC-009): serialized proofs from root → leaf →
   * data. Verified self-containedly by `verifyTreeSignature(rootPublicKey, data, sig)`.
   */
  treeSignature: string;
  /**
   * Optional opaque proof binding the signing address to the root identity,
   * verified by a registered `proofVerifiers['root-identity']` (see §5.1.1).
   */
  rootIdentityProof?: string;
  /** Hex Minima address; optional on the wire, derivable, never trusted without a proof. */
  address?: string;
}
```

- The durable identity is the **root TreeKey** (`@totemsdk/root-identity`, `UnifiedIdentityWallet`); the signing leaf is leased.
- Verification of the signature is self-contained: `verifyTreeSignature(expectedPubkey, data, signature)` walks the proof chain root→leaf and checks each Winternitz signature (`packages/core/src/treekey.ts:776`). The verifier needs only the message bytes and `WotsIdentity`.

#### 5.1.1 Address binding is a separate, pluggable proof

Two different self-contained verifications exist and must not be conflated:

- **Signature validity:** `verifyTreeSignature` proves the message was signed by the leaf under `rootPublicKey`. It does **not** prove an address.
- **Address/identity binding:** `SignedManifest.rootIdentityProof` is an *opaque string* verified by a registered `proofVerifiers['root-identity']` handler, which returns `provenAddresses` (`packages/identity/src/manifest-binding.ts:75-100`). Without a registered verifier it is silently ignored.

Therefore `WotsIdentity.address`, when present, is only trusted if `rootIdentityProof` verifies **and** yields that address. The node treats `address` as advisory otherwise. (Note: a `SignedManifest` signature is **flat** WOTS via `wotsVerifyDigest` over a 32-byte PKdigest — `packages/manifest/src/verify.ts:40` — whereas the root-identity chain is hierarchical `TreeKey`; the lookup envelope uses the hierarchical form.)

### 5.2 Every access request is self-authenticating

Replace the `AUTH_CHALLENGE`/`AUTH_RESPONSE` handshake with identity carried on each request:

```ts
export interface SignedLookupMessage {
  // …existing BaseMessage fields (type/version/id/payload)…
  identity: WotsIdentity;          // §5.1
  /** Anti-replay: monotonic per-identity nonce. */
  nonce: number;
  /** Anti-replay: absolute expiry (epoch ms). */
  expiresAt: number;
}
```

- **Digest signed by the TreeKey:** `sha3_256(canonicalJson(payload) ‖ nonce ‖ expiresAt)` — deterministic, domain-separated. The TreeSignature in `identity.treeSignature` must verify over this digest against `identity.rootPublicKey` via `verifyTreeSignature`.
- The node then independently enforces §5.3 (index/nonce replay) and, when `address` is claimed, the `rootIdentityProof` binding (§5.1.1).
- This removes `server-auth.ts`’s challenge/verify entirely; the challenge becomes an optional nonce source only.

### 5.3 One-time safety and replay rejection (the critical part)

WOTS reuse is catastrophic (`docs/security/crypto-policy.md` §1). Two distinct protections:

1. **Index leasing (signer side):** every signature consumes one leased leaf index through `@totemsdk/wots-lease` (`LocalLeaseProvider` / `AxiaLeaseProvider` / `HybridLeaseProvider`), with the `LeaseJournal` as the append-only audit log and monotonic watermarks (`WatermarkMonotonicityError`, `WatermarkExhaustedError`).
2. **Replay rejection (verifier side):** the node records each accepted `(signerPublicKey, index)` — or `(signerPublicKey, nonce)` — and **rejects any reuse**, plus enforces `expiresAt`. A WOTS signature is static, so a verbatim replay must be rejected at the node; this is mandatory, not optional.

```ts
// lookup-node
interface ConsumedIndexStore {           // durable (SQLite), per node
  claim(identityProofHash: string, index: number, expiresAt: number): Promise<boolean>; // false = replay
  purge(now: number): Promise<void>;
}
```

Failure semantics mirror the rest of the system: **fail closed** — an unverifiable proof, a reused index/nonce, or an expired message is dropped (never accepted).

### 5.4 Session tickets (to bound index consumption)

A self-authenticating request consumes a leaf index. A chatty client would burn leaves quickly (per-address capacity is finite; the crypto policy cites 262,144). To bound this without weakening PQ guarantees:

- **Establish once with WOTS** (one leased index): the node verifies the identity and issues a **node-signed session ticket**, generalizing the existing lease-certificate pattern (`lookup-node/src/lease.ts:_issueCertificate`).
- The ticket is signed by the **node’s own WOTS/TreeKey identity** (replacing the node’s ephemeral Ed25519 key, §5.5) and bound to the client’s `address`/`rootPublicKey` with a short TTL. The client’s single leased index (§9 Q1) is consumed once here, not per ticket redemption.
- Subsequent requests present `{ ticket, request }`; the client’s root identity remains the authenticated principal, so identity is still attached to access requests.
- Tickets are optional and node-policy-driven (`sessionTtlMs`, `maxRequestsPerTicket`); a node may require WOTS-per-request for high-value operations.

This is the recommended default: **WOTS for identity establishment, node-signed tickets for chattiness.**

### 5.5 Node identity (`lookup-node/src/lease.ts`)

- Replace the ephemeral Ed25519 cert signer with a **node WOTS/TreeKey identity** (`_signFn` becomes WOTS over `sha3_256(certBytes)`, using the node's leased indices).
- `nodeId` becomes the root/leaf **public-key digest** (`sha3_256(pubkey)`) rather than a hash of an Ed25519 raw key — consistent with `TreeKey` (`packages/core/src/Streamable.ts:416-419`).
- `LeaseCertificate` carries the node’s `signerPublicKey` + `rootIdentityProof` so clients verify certification self-containedly.

### 5.6 Wire format (hard switch, `lookup-protocol` v2)

`messages.ts` changes:

- Remove `publicKey?: string` / `signature?: string` **Ed25519** semantics from `AppAnnounceMessage` and `AgentAnnounceMessage`.
- Add the `SignedLookupMessage` envelope (`identity: WotsIdentity`, `signature`, `nonce`, `expiresAt`).
- Bump `PROTOCOL_VERSION` to `2` (`lookup-protocol/src/version.ts`).
- Remove `AUTH_CHALLENGE` / `AUTH_RESPONSE` messages and `auth.ts`’s Ed25519-oriented docs; keep `messageDigest` (already SHA3-256, `lookup-protocol/src/auth.ts:44-47`) and retarget `SignFn`/`VerifyFn` to WOTS.

Because this is a **hard switch**, v1 and v2 peers do not interoperate. Every node and client must be upgraded together (see §7).

### 5.7 Hash hygiene (why SHA-256 is out of scope)

The lookup digest is already SHA3-256 (`lookup-protocol/src/auth.ts:46`). The SDK’s SHA-256 sites are either **consensus** (`kissvm` `SHA2` opcode, `eval.ts:366` / `rust/eval.rs:331` — Minima parity, must not change), **symmetric** (`se-server/seKey.ts:18` HMAC-SHA256 KDF), or **non-consensus local ids** (`wots-lease/journal.ts:64`, `agent-policy/receipt-store.ts:46`, `omnia/intent.ts:45`, `omnia-host/.../operations.ts:140`). None are the quantum concern, and migrating them is hygiene, not PQ. This RFC leaves them alone.

## 6. Compatibility

- **Breaking by design.** `lookup-protocol` v1 → v2; Ed25519 fields removed.
- `lookup-client` and `lookup-node` are upgraded together; no dual-verify path is built.
- Dependencies: `lookup-protocol` already depends on `@totemsdk/core` (`messages.ts:8` imports `WotsIndices`; `auth.ts:14` imports `sha3_256`), so `verifyTreeSignature` is available with no new dep. `lookup-client` gains `@totemsdk/wots-lease` + `@totemsdk/root-identity` for signing. `lookup-node` already depends on `@totemsdk/core` and `@totemsdk/wots-lease`; it additionally needs a `proofVerifiers['root-identity']` registration (from `@totemsdk/identity`) to validate `rootIdentityProof` (§5.1.1).

## 7. Security considerations

| Case | Behaviour |
|---|---|
| **WOTS index reuse** | Prevented by `wots-lease` leasing + node-side consumed-index store; `WatermarkMonotonicityError` on regression. |
| **Replay of a valid signature** | Rejected: `(identity, index/nonce)` consumed once + `expiresAt` enforced. |
| **Forged `rootIdentityProof`** | Rejected by `verifyTreeSignature`; `address` never trusted without proof. |
| **Index/nonce exhaustion DoS** | Bounded by session tickets (§5.4); per-identity nonce windows purged on expiry. |
| **Downgrade to Ed25519** | Impossible: hard switch removes the code path. |
| **Node cert forgery** | Node certs are WOTS-signed with a `rootIdentityProof`; verified self-containedly. |
| **Lease authority unavailable** | Signer fails closed; client cannot sign without a leased index (no fallback to unleased signing). |

## 8. Phases

| Phase | Work | Gate |
|---|---|---|
| **P0** | This RFC; freeze the v2 identity/envelope types and digest domain. | — |
| **P1** | `lookup-protocol` v2: `WotsIdentity`, `SignedLookupMessage`, digest, remove Ed25519/AUTH_*. | Unit: digest vectors; type export |
| **P2** | Signer path: `lookup-client` uses a `root-identity` + `wots-lease` signer (leased index); remove `generateIdentityKeyPair` Ed25519. | Unit: signed request verifies; index consumed once |
| **P3** | Verifier path: `lookup-node` `registry.ts` / `server-auth.ts` → `verifyTreeSignature`; consumed-index store; delete `verifyEd25519`. | Unit: valid/invalid/expired/replay |
| **P4** | Node identity: `lease.ts` cert signer → WOTS; `nodeId` = pubkey digest. | Unit: cert verifies self-containedly |
| **P5** | Session tickets (node-signed, TTL, request cap); `trust.ts` reviewer verifier → WOTS. | Unit: ticket issue/redeem/expire |
| **P6** | End-to-end: announce/query/auth over v2 against a live node; adversarial suite (replay, forged proof, index reuse, expired, downgrade). | E2E + adversarial green |

## 8a. Implementation status (TypeScript)

Shipped (tests green: protocol 21, client 22, node 47):

- **P1** `lookup-protocol` v2 — `PROTOCOL_VERSION = 2`; `AUTH_CHALLENGE`/`AUTH_RESPONSE` and Ed25519 fields removed; `WotsAuthEnvelope` on `BaseMessage`; `authDigest`/`signMessage`/`verifyMessageAuth` are async and WOTS-based; `canonicalJson` exported.
- **P2** `lookup-client` — `LookupIdentity` (TreeKey) + `Authenticator`; `authenticateIdentityKeyPair`/`runAuthHandshake` removed; `RpcLayer` stamps every outgoing message; no handshake in `_connect`.
- **P3** `lookup-node` — `server-auth.ts` deleted; `auth-verify.ts` verifies the envelope with `verifyTreeSignature`; `ReplayGuard` enforces per-identity nonce monotonicity; `session.ts` verifies per message; `registry.ts` verifies the WOTS-signed manifest via `verifyManifest`; storage schema uses `signerAddress` (Ed25519 `publicKey`/`signature` columns removed).
- **P4** `lease.ts` node identity is now a WOTS/TreeKey; `nodeId` = WOTS public-key digest.
- **P5** `trust.ts` unchanged — its reviewer verifier is already pluggable (`verifyReviewerSignature`), which is the required seam. Session tickets are **not** implemented; the client currently signs per message (one TreeKey use each). A client can raise `authTtlMs` but not amortise uses. **Plan:** `docs/rfc/RFC-032-AMENDMENT-A-SESSION-TICKETS.md`.
- **Identity wiring** — `lookup-client` can derive its identity from `@totemsdk/root-identity` (`LookupIdentity.fromWallet`) with forward-only watermark advance (RFC-032 §9 Q1).

Not done:
- **Go mirrors** (`packages/lookup-*/go`) are updated to the v2 shape (handshake and Ed25519 removed, `WotsAuthEnvelope`, `ReplayGuard`, fail-closed `WotsSigner`/`WotsVerifier`), but there is **no byte-exact WOTS implementation in Go** in this repo (same as `se-server` AUD-045), so the Go signer/verifier fail closed until a cross-language-tested port lands. Not compiled/tested here (no Go toolchain).
- **Generated TypeDoc** under `TotemEdgeSDKDocs/docs/api/**` is stale; regenerate.
- **Live-key derivation**: `LookupIdentity.fromSeed` is the primitive; wiring `@totemsdk/root-identity` + `@totemsdk/wots-lease` for the default identity (RFC-032 §9 Q1) is left to the deployment/wallet layer.

## 9. Resolved decisions & open questions

**Resolved**

- **Q1 — Lease authority: reuse the client's RFC-013 provider; add no new authority.**
  A WOTS signature consumes one leased key index, which needs a watermark
  authority. The SDK already has three (RFC-013): local `LocalLeaseProvider`
  (offline, client-owned), Axia (hosted default), on-chain/hybrid. The lookup
  identity *is* the root identity, so it uses the **same** authority that root
  identity already uses for every other signature. The client leases **one index
  per session establishment** (§5.4 session tickets), not per request. The lookup
  node only verifies signature + proof and enforces replay/uniqueness; it is
  **not** the client's lease authority. Rationale: one identity, one watermark,
  one lease provider across the SDK; the lookup node stays stateless w.r.t.
  client watermarks; no bootstrap problem (rejected the alternative of the
  lookup node acting as client lease authority, which would require identity to
  obtain identity).
- **Q5 — Rollout: hard switch, no migration window.** There are no existing
  lookup users, so `lookup-protocol` goes straight to v2 with Ed25519 removed;
  no dual-verify path, no sunset period.

**Open**

- **Q2** Index budget per identity: how many leaves may a lookup identity consume before re-keying? (`root-identity` allows 64 child addresses, each with a WOTS index space.) With one index per session, the practical budget is driven by session count.
- **Q3** Session-ticket TTL and request-cap defaults; whether any operation mandates WOTS-per-request.
- **Q4** Should `address` be required on the wire (verifiable) or always derived?

## 10. References

- `docs/security/crypto-policy.md` — WOTS key-reuse prevention, entropy, constant-time
- `docs/rfc/RFC-008-FEDERATED-STATECHAIN.md` — root-identity / federation
- `docs/rfc/RFC-009-KISSVM-SIGNATURE-FIDELITY.md` — TreeKey `SignatureProof`
- `docs/rfc/RFC-013-WALLET-SELF-HOSTED-MODE.md` — lease provider selection
- `packages/manifest/src/{types,verify,encoding}.ts` — WOTS-signed `SignedManifest`
- `packages/root-identity/src/UnifiedIdentityWallet.ts`, `packages/wots-lease/src/*`
- `packages/lookup-{protocol,client,node}/src/{auth,messages,client,registry,server-auth,lease}.ts`
- `packages/core/src/index.ts` — `verifyTreeSignature`, `wotsVerify`, `TreeKey`, `sha3_256`
