# RFC-070 — Totem Namespace and Name Resolution

**Status:** Proposed — design only; no implementation authorised
**Priority:** P1 (identity and discovery)
**Created:** 2026-10-23
**Authors:** Totem SDK Contributors
**Depends on:** RFC-032 (lookup identity), RFC-037 (unified WOTS), RFC-048 (Omnia primitives), RFC-055 (routing), RFC-056 (entity projection, Amendment A), RFC-057 (replication), RFC-064 (off-chain principles), RFC-068 (onion/blinded paths)
**Touches:** `identity`, `root-identity`, `manifest`, `lookup-*`, `proof`, `proofgraph`, `kissvm`, `tx-builder`, `txpow`, `storage`, `pear`, `entity`; proposed `@totemsdk/names` only if a later RFC proves the package boundary.

> **Positioning.** A name is an alias for a verified entity, not the entity
> itself. The name registry provides uniqueness and discovery; `@totemsdk/entity`
> remains a local, disclosure-bounded projection layer.
>
> A DHT or Hypercore log can store `@alice → record`, but it cannot by itself
> guarantee that only one `@alice` exists. Global uniqueness needs a consensus
> anchor or an explicit namespace owner. This RFC therefore proposes an
> on-chain singleton registry root plus off-chain signed records and P2P
> resolution.

---

## 1. Decisions

1. **Canonical form is `totem:name:<label>`; `@<label>` is display syntax.**
2. **The registry is not a central server.** A singleton on-chain registry root
   commits to name records; the records themselves are replicated off-chain.
3. **A name binds to an entity reference or root/child identity.** It does not
   replace the root identity, and a public name does not imply disclosure of the
   root.
4. **Privacy is a signed property of the name record.** `minimal` disclosure is
   the default; root, children, payment endpoints, contact endpoints and balance
   proofs are explicit choices.
5. **Entity remains local.** Name resolution returns verified sources; callers
   invoke `resolveEntity()` and `projectEntity()` only when policy permits.
6. **No new package is authorised by this RFC.** Start by extending
   `identity`/`lookup-protocol` and using existing primitives. A package boundary
   must be proven before `@totemsdk/names` is created.

---

## 2. Name model

### 2.1 Labels and namespaces

```text
@alice                    display form
totem:name:alice          canonical form
totem:name:alice@totem    explicit namespace
```

Normalization before hashing:

- Unicode NFC;
- lowercase;
- confusable folding;
- length and character limits;
- reserved labels (`totem`, `admin`, `security`, `support`, etc.).

Subnames are parent-controlled:

```text
@alice/device-1
@alice/agent/payments
```

Only the parent label needs a global registry entry. The parent root signs
subname records.

### 2.2 NameRecord

```ts
interface NameRecord {
  namespace: string;
  label: string;
  nameKey: string;              // H(namespace || normalizedLabel)

  identity: {
    entityRef: string;          // opaque, stable reference
    rootRef?: string;           // optional; only when root disclosure is allowed
    childRef?: string;          // optional; per-context child identity
  };

  privacy: NamePrivacy;
  payment?: PaymentEndpoint;
  contact?: ContactEndpoint;
  resolverEndpoints: string[];  // lookup nodes, Hyperswarm, HTTPS, onion

  sequence: number;
  issuedAt: number;
  expiresAt?: number;
  previousRecordHash?: string;
  signature: string;            // WOTS signature by root/controller
}
```

The record is a signed alias. The registry entry commits to the record hash;
the record can be updated without changing the name.

---

## 3. Registry architecture

### 3.1 On-chain singleton root

A namespace has one registry state coin:

```text
state[0] = namespace id
state[1] = registry root (MMR)
state[2] = sequence
state[3] = policy hash
```

Each name is a leaf:

```text
leaf = H(nameKey || recordHash)
```

The registry covenant enforces:

- one leaf per `nameKey`;
- update/transfer only by the current controller/root;
- valid MMR transition from old root to new root;
- expiry/renewal/auction rules where configured;
- no duplicate insertion.

`@totemsdk/core` provides the MMR primitives; `kissvm` provides membership and
state-transition patterns. The exact non-inclusion/update proof is an
implementation task.

### 3.2 Off-chain records

Records are stored in Hypercore/Autobase logs (RFC-057), lookup nodes, and local
caches. The on-chain registry contains only the root and ownership state.

A lookup node is untrusted. A client verifies:

1. the record signature against the root/controller;
2. inclusion of the record hash in the current registry root;
3. the registry root is current and not stale;
4. the resolver endpoint is signed by the same identity;
5. the identity/claims have not expired or been revoked.

A malicious node can withhold data; it cannot forge a name binding.

### 3.3 Why not a DHT-only registry

A DHT gives you a key-value store, not a uniqueness consensus. Two parties can
publish conflicting `@alice` records. Without a chain anchor or an explicit
namespace owner, there is no objective winner. A DHT-only namespace is fine for
private/community namespaces where conflicts are resolved out of band; it is not
sufficient for a global `@name`.

---

## 4. Privacy profiles

Privacy is configured per name and signed into the record.

```ts
type DisclosureMode =
  | 'public'
  | 'pseudonymous'
  | 'private'
  | 'capability'
  | 'attested';

interface NamePrivacy {
  mode: DisclosureMode;

  discloseRoot: boolean;
  discloseChildren: 'none' | 'proof-only' | 'list';

  payment:
    | { kind: 'direct'; address: string }
    | { kind: 'child'; childIndex: number }
    | { kind: 'relay'; endpoint: string }
    | { kind: 'omnia'; channelOrFactory: string }
    | { kind: 'blinded'; path: string };

  contact:
    | { kind: 'public'; endpoint: string }
    | { kind: 'relay'; endpoint: string }
    | { kind: 'onion'; endpoint: string }
    | { kind: 'capability'; capabilityId: string };

  balanceProof:
    | { kind: 'none' }
    | { kind: 'attested'; issuer: string; predicate: string }
    | { kind: 'commitment'; commitment: string };

  audience: 'public' | 'authenticated' | `capability:${string}` | `group:${string}`;
  purposes: string[];
  expiresAt?: number;
}
```

### 4.1 Disclosure matrix

| Question | Possible disclosure |
|---|---|
| Who is this? | root identity, child identity, opaque `entityRef`, or nothing |
| How do I pay? | direct address, child address, relay inbox, Omnia channel, blinded path |
| How do I contact? | public endpoint, relay, onion service, capability-gated inbox |
| What can I prove? | ownership, membership, credential, balance threshold, governance role |
| Who may resolve it? | anyone, authenticated party, capability holder, group |

### 4.2 Profiles

| Mode | Default disclosure | Use |
|---|---|---|
| `public` | root, display identity, public endpoints | organisations, services, public figures |
| `pseudonymous` | `entityRef`, no root, child/relay payment, relay contact | default personal/agent name |
| `private` | encrypted record; existence may be hidden with a salted nameKey | private groups, family, internal names |
| `capability` | record decryptable only with an owner-signed capability | private services, paid access |
| `attested` | no root; attestation/commitment proof only | balance/credential-dependent names |

The default SHOULD be `pseudonymous`, not `public`.

### 4.3 Root-identity limits

`root-identity` can prove that child addresses share a root, but the current
`OwnershipProof` includes `rootAddress` and `rootPublicKey`. It is therefore a
**selective-disclosure** proof, not an anonymous one. Use it only for an
authorised verifier, not in a public name record.

For public names, prefer:

- a child identity/`entityRef`;
- a relay/payment endpoint;
- a proof that is scoped to the requested purpose.

A future anonymous root-membership proof would require a commitment/ZK
construction that is not part of the current SDK.

---

## 5. Receiving and contact without the core address

### 5.1 Payment endpoints

A name can resolve to:

- a dedicated child address;
- a relay inbox that returns a fresh address per payment;
- an Omnia channel/factory endpoint;
- a blinded receiving path (RFC-068).

The core address never appears in the public record. Reusing a child address
still links payments; prefer a relay/payment code or fresh address per payer.

### 5.2 Contact endpoints

A name can resolve to a relay, lookup inbox, onion service, or capability-gated
endpoint instead of a root address. The endpoint is signed and rotatable without
changing the name.

### 5.3 Balance and asset-value proofs

`root-identity` proves control, not value.

| Profile | What it proves | Trust assumption |
|---|---|---|
| `attested` | issuer signs asset, threshold and `asOf` | trust the issuer/auditor |
| `commitment` | commitment to holdings and total | trust the commitment issuer unless challenged |
| `zk` (future) | threshold without revealing holdings | requires new ZK circuit/verifier; not current |

Do not claim a trustless hidden-balance proof until a ZK construction and
verifier exist. A name may publish an attestation without exposing addresses;
that is useful, but it is not equivalent to a zero-knowledge proof.

---

## 6. Multisig, governance and organisations

A name can resolve to a policy rather than a person:

- `@treasury` → threshold policy + signer commitments + governance mandate;
- `@org` → organisation identity + roles + manifests;
- `@delegate` → delegation claim + voting scope;
- `@council` → governance policy root + role capabilities.

Privacy patterns:

- publish the threshold and policy hash;
- disclose signer identities only to authorised counterparties;
- keep the full signer set committed, not listed;
- prove voting weight/threshold via an attested or commitment profile;
- keep the delegation graph private unless the governance process requires it.

This composes with `authority`, `governance`, `identity` claims and `entity`
projections.

### 6.1 Other use cases

- service discovery without owner root disclosure;
- device/agent subnames under a parent name;
- credential/KYC proofs without the full identity graph;
- reputation thresholds without full history;
- escrow/multisig names that resolve to a script/policy;
- private contact endpoints that rotate behind a stable `@name`;
- context-separated names (`@alice/work`, `@alice/personal`) bound to different
  child identities.

---

## 7. Resolution flow

1. Normalize the label and compute `nameKey`.
2. Query several lookup nodes / DHT / local cache.
3. Verify the record signature and registry inclusion proof.
4. Apply the record's privacy policy and the caller's purpose/capability.
5. Return a `ResolvedName` with only the permitted fields.
6. Optionally pass verified sources to `resolveEntity()` and
   `projectEntity()`.

A resolver MUST fail closed on missing proofs, stale roots, conflicting records
or invalid signatures. Absence of disclosure is `unknown`, not `false`.

### 7.1 Entity integration

```text
@alice
  → Name Resolution (this RFC)
      → verified NameRecord + privacy policy
  → EntitySources
      → resolveEntity()
      → projectEntity()
```

`@totemsdk/entity` remains local-first. It must not fetch names itself. RFC-056
Amendment A ensures `minimal` discloses no root, so a name resolver can return an
`entityRef` without leaking the root by accident.

A later RFC-056 amendment may add a `name-resolution` purpose or an optional
`ResolvedName` source; the network registry stays outside Entity.

---

## 8. Existing primitives

| Layer | Package |
|---|---|
| Root identity / ownership proofs | `root-identity` |
| Identity documents, claims, rotation, revocation | `identity` |
| Manifests and resolver endpoints | `manifest` |
| Name query/announce messages | `lookup-protocol`, `lookup-client`, `lookup-node` |
| Signed evidence and inclusion proofs | `proof`, `proofgraph` |
| MMR membership and registry covenant | `kissvm`, `core` |
| Registry transaction | `tx-builder`, `txpow`, `chain-provider` |
| Off-chain replication | `storage`, `pear`, RFC-057 |
| Disclosure-bounded projection | `entity` |

No new package is required for the design phase.

---

## 9. Security and threat model

- **Squatting/impersonation:** fees, auctions, renewals, reserved names, dispute
  policy.
- **Registry control:** who can update the covenant? A single key is a
  centralisation point even if records are off-chain.
- **Root linkage:** public root disclosure links all child activity; default to
  `entityRef`/child identity.
- **Resolver metadata:** queries reveal interest; use relay/onion/blinded paths
  where needed.
- **Attestor trust:** balance attestations are only as good as the issuer.
- **Data availability:** a name with no reachable record is unresolved; clients
  must not treat that as revocation.
- **Key loss/rotation:** names must survive controller rotation; recovery policy
  is explicit.
- **Replay/reorg:** registry proofs carry sequence/root; clients reject stale
  roots.
- **Privacy is not anonymity:** a public name is public; encryption and
  capability-gated records are separate profiles.
- **WOTS hygiene:** every signed record uses the lease/watermark discipline; no
  one-time key reuse.

---

## 10. Acceptance gates

### Design gate

- canonical label rules and normalization test vectors;
- registry state transition and non-inclusion proof design;
- name-record schema and privacy profiles;
- resolution conflict/failure semantics;
- anti-squatting and governance policy.

### Prototype gate

- real registry covenant on a test chain;
- transfer, rotation, expiry and revocation;
- name resolution through at least two independent lookup nodes;
- client-side signature + inclusion proof verification;
- privacy profiles: public, pseudonymous, private/capability, attested.

### Production gate

RFC-063 gates apply. No production claim until the registry covenant, resolution
path, anti-squatting policy and independent review are complete.

---

## 11. Non-goals

- A DHT-only global namespace with no uniqueness mechanism.
- A centralised registry server.
- ENS wire/name compatibility.
- Trustless hidden-balance proofs without a ZK construction.
- Storing personal data on-chain.
- A new package before the boundary is proven.

---

## 12. Open questions

1. Is the registry root one global namespace, or a set of community namespaces?
2. Who controls the registry covenant, and how are policy changes governed?
3. Should `@alice` resolve to an `entityRef` by default, with root disclosure only
   on request?
4. What is the anti-squatting model: fee, auction, proof-of-personhood, or
   invite-only?
5. Do private names use salted name keys, encrypted records, or both?
6. Should balance proofs be attestation-first, commitment-first, or wait for ZK?
7. How are subname policies inherited and revoked?
8. What is the minimum viable lookup-node discovery path before RFC-057 lands?
