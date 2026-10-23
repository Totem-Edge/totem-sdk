# RFC-071 — Announcement Envelope and Discovery Consolidation

Status: **Draft — Phase 1 implemented.** `@totemsdk/manifest` now exposes the generic
`AnnouncementEnvelope`, signing/verification, topic derivation and ranking;
`@totemsdk/liquidity-bond` exposes the first projection adapter (`createPoolAnnouncement`).
Transport adapters, host/registry indexing and MOKA integration remain Phase 2.
Created: 2026-10-23
Authors: Totem SDK Contributors
Depends on: RFC-039 (Custody Conformance), RFC-048 (Omnia Primitive Completeness), RFC-050 (Eefi Product Architecture), RFC-058 (Custody Modes and Disclosure Gate), RFC-059 (Eefi Credit and Discoverable Liquidity)
References: RFC-032 (lookup stack), RFC-034/RFC-035 (Omnia relay/coordination), RFC-053 (Eefi generic contracts), RFC-060 (Bootstrap Points)
Touches: `manifest`, `liquidity-bond`, `omnia-pool`, `omnia-router`, `lookup-protocol`, `lookup-node`, `pubsub-transport`, `omnia-relay`, `connect`, MOKA (external consumer)

> **Positioning.** Consolidate the **announcement layer**, not the economic
> manifests. A pool manifest, a credit offer, a signed quote and a provider
> manifest stay the source of truth. An announcement is a short-lived, signed
> projection that says “this subject is available now, under this custody and
> liquidity disclosure, at this sequence/expiry”.

---

## 1. Problem

The SDK currently has several unrelated announcement/discovery shapes:

| Shape | Home | Role |
|---|---|---|
| `APP_ANNOUNCE`, `AGENT_ANNOUNCE`, `POLICY_ANNOUNCE` | `lookup-protocol` | lookup registry messages |
| `SwapAnnouncement` | `omnia-router` | in-memory routing hint |
| `LiquidityPoolManifest` | `liquidity-bond` | signed pool source of truth |
| `ProviderBondManifest` | `provider-bond` | signed provider source of truth |
| `EefiMarketAgreement` | `eefi` | signed quote source of truth |
| `EdgeServiceManifest` | `manifest` | signed service declaration |
| proposed `OpportunityManifest` | RFC-059 | cross-source discovery |

Each invents its own freshness, signature, custody and liquidity rules. That is
the duplication. The source-of-truth manifests are not the duplication.

---

## 2. Decision

1. **Do not add a fifth/sixth `Manifest` kind for opportunities.**
2. Add a generic **`AnnouncementEnvelope`** in `@totemsdk/manifest`: data-only,
   signed with the existing WOTS/TreeKey primitives, domain-separated, and
   independent of any product package.
3. Keep product schemas as the source of truth. An announcement references them
   by `subjectId` + `subjectHash`; it does not restate pool fees, credit
   schedules, quote pricing or provider scores.
4. Add **projection adapters** in the owning package, starting with
   `createPoolAnnouncement` in `@totemsdk/liquidity-bond`.
5. Consolidate **topics, freshness, custody/liquidity disclosure, dedupe and
   ranking** in the envelope. Leave transport and indexing pluggable.
6. Do not silently overload `APP_ANNOUNCE` or other unrelated lookup messages
   (RFC-048 §3.1). A lookup-protocol extension, if needed, must be a new
   versioned message type.

---

## 3. Envelope

```ts
type AnnouncementKind =
  | 'service'
  | 'provider'
  | 'liquidity-pool'
  | 'credit-offer'
  | 'swap-rate'
  | 'router-capacity'
  | 'opportunity';

interface AnnouncementEnvelope<T = unknown> {
  version: 'totemsdk-announcement/v1';
  announcementId: string;        // canonical: kind + subjectId + publisher
  kind: AnnouncementKind;
  subjectId: string;             // source manifest / position id
  subjectHash: string;           // binds to the source of truth
  publisher: string;             // signer address
  sequence: number;              // monotonic per publisher+subject
  createdAt: number;
  expiresAt: number;
  asset?: string;                // primary asset/currency, if applicable
  secondaryAsset?: string;

  custody?: AnnouncementCustody; // RFC-058 context, verified from operator manifest
  disclosureHash?: string;

  liquidity?: {
    mode: 'exact' | 'bucketed' | 'range' | 'hidden';
    advertised?: string;
    verifiedAvailable?: string;
    asOfHeight?: string;
    asOfTime?: number;
    proofRefs?: string[];
  };

  topics: string[];
  payload?: T;                   // small kind-specific fields only
  payloadHash: string;           // canonical payload digest
  nonce: string;
}

interface SignedAnnouncement<T = unknown> {
  announcement: AnnouncementEnvelope<T>;
  authorAddress: string;
  signerPublicKey: string;
  signedAt: number;
  signature: string;
}
```

The envelope is deliberately not a money object. It carries no balances, no
collateral, no debt and no execution right. It is a signed index record.

---

## 4. What each layer owns

| Concern | Owner |
|---|---|
| Pool terms, capacity, fees, lock/risk | `liquidity-bond` |
| Provider identity, bond, score, incidents | `provider-bond` |
| Credit terms and debt state | `eefi-credit` (RFC-059) |
| Quote price/fees/deadline | `eefi` |
| Swap rate/capacity/channel pair | `omnia-router` |
| Service identity/endpoints/transport | `manifest` (`EdgeServiceManifest`) |
| Announcement schema, signature, topics, ranking | `manifest` (`AnnouncementEnvelope`) |
| Topic transport (Hyperswarm/relay/pubsub) | `stream-transport`, `omnia-relay`, `pubsub-transport` |
| Durable index/query | `lookup-node` / `omnia-host` |
| Product display | MOKA |

An announcement MUST reference, not duplicate, the source row.

---

## 5. Identity and verification

`announcementId` is stable across revisions:

```text
announcementId = SHA3-256('totemsdk:announcement:id:v1' | {kind, subjectId, publisher})
```

`payloadHash` is the canonical digest of `payload`. `announcementDigest` covers
the full envelope. Signing uses the same unified WOTS/TreeKey path as
`signManifest`; there is no second signature scheme.

`verifyAnnouncement` MUST check:

1. version, schema and canonical `announcementId`;
2. `payloadHash` matches `payload`;
3. `publisher === authorAddress` and the WOTS signature is valid;
4. `expiresAt > now` when a clock is supplied;
5. `subjectHash` matches the resolved source manifest (caller/adapter);
6. custody, if present, matches a signed operator manifest (RFC-058);
7. sequence is not older than the last accepted record for
   `(publisher, subjectId)`.

Missing or invalid `custody` fails closed for ranking/signing; it is not treated
as self-custody.

---

## 6. Topics and transport

```text
totemsdk:announcement:v1:index
totemsdk:announcement:v1:<kind>
totemsdk:announcement:v1:<kind>:<asset>
totemsdk:announcement:v1:<kind>:<asset>:<custody>
```

Topics are derived with SHA3-256 and the existing `stream-transport` 32-byte
convention. Transport is pluggable:

- Hyperswarm/relay via `stream-transport`/`omnia-relay`;
- pub/sub via `pubsub-transport`;
- durable/queryable registry via `lookup-node` or `omnia-host`.

An announcement is valid without a particular transport. Transport MUST NOT
become the source of truth.

---

## 7. Ranking

MOKA’s default order:

```text
custody: self (0) < trust-minimised (1) < hosted (2) < unknown (3)
then verifiedAvailable descending (BigInt, not float)
then sequence descending
```

`rankAnnouncements` is pure and transport-free. Advertised liquidity is never
treated as verified. Exact disclosure is opt-in; bucketed/range is the default
for privacy (RFC-048 §3.5).

---

## 8. First adapter: pools

`@totemsdk/liquidity-bond` now exposes:

```ts
createPoolAnnouncement({
  manifest,              // LiquidityPoolManifest (source of truth)
  publisher, sequence, createdAt, expiresAt, nonce,
  custody?, disclosureHash?, liquidity?, topics?,
}): AnnouncementEnvelope<PoolAnnouncementPayload>
```

`subjectId = poolId`, `subjectHash = pool manifest hash`, `kind =
'liquidity-pool'`. The payload contains only pool type, purpose, capacity,
commitment bounds and hashes of lock/fee/risk terms. It does not copy the
terms themselves.

Later adapters: `createProviderAnnouncement` (`provider-bond`),
`createCreditAnnouncement` (`eefi-credit`), `createSwapRateAnnouncement`
(`omnia-router`) and `createServiceAnnouncement` (`manifest`).

---

## 9. Security invariants

- An announcement cannot create, move or custody value.
- `announcementId` is stable across revisions; `sequence` orders revisions.
- `subjectHash` binds the announcement to the source manifest; a mismatched
  source is invalid.
- `payloadHash` binds the small payload; changing it invalidates the signature.
- `publisher` must equal the signer address.
- Expired or stale announcements are dropped.
- Custody is verified from a signed operator manifest, never from the dApp.
- `verifiedAvailable` requires a proof reference; otherwise it is `advertised`.
- Replay is rejected by `(announcementId, sequence)` and expiry.
- Topics are domain-separated; an announcement cannot be replayed into an
  unrelated kind/asset topic without re-signing.
- No precise counterparty balances or route topology in public announcements.

---

## 10. Relationship to existing announcements

- `SwapAnnouncement` remains the router’s in-memory routing hint. A future
  `createSwapRateAnnouncement` wraps it in the envelope for discovery; routing
  still consumes the router-native record.
- `lookup-protocol` remains the durable registry. Do not overload
  `APP_ANNOUNCE`/`AGENT_ANNOUNCE`; add a new versioned message type only if the
  lookup transport is chosen for announcement indexing.
- `LiquidityPoolManifest`, `ProviderBondManifest`, `EefiMarketAgreement` and
  `EdgeServiceManifest` are unchanged source-of-truth records.
- `OpportunityManifest` from RFC-059 is superseded by
  `AnnouncementEnvelope(kind: 'opportunity' | 'liquidity-pool' | ...)`; RFC-059
  should reference this RFC rather than introduce a new manifest kind.

---

## 11. Implementation status

Phase 1 (landed with this RFC):

- `@totemsdk/manifest`: `AnnouncementEnvelope`, `SignedAnnouncement`,
  `createAnnouncement`, `validateAnnouncement`, `signAnnouncement`,
  `verifyAnnouncement`, `announcementTopic`, `rankAnnouncements`,
  canonical ID/payload/digest helpers.
- `@totemsdk/liquidity-bond`: `createPoolAnnouncement` projection adapter.
- Tests: envelope create/sign/verify/tamper/expiry/topic/rank; pool projection.
- `@totemsdk/manifest`: `MemoryAnnouncementStore` — verifies envelopes, enforces
  monotonic sequence per `(publisher, subjectId)`, prunes expired records and
  returns ranked/filtered results. It is an in-memory reference index, not a
  durable registry.

Phase 2 (not yet authorised here):

- provider/credit/swap-rate/service adapters;
- Hyperswarm/relay/pubsub subscription service;
- durable lookup-node or omnia-host announcement index backed by the reference store;
- MOKA `OpportunityView` replacement;
- RFC-058 custody disclosure binding in the signed envelope.

---

## 12. Open questions

1. Should `AnnouncementEnvelope` live permanently in `manifest`, or be extracted
   to `@totemsdk/announcement` once transport adapters land?
2. Does the lookup registry become the canonical index, or does `omnia-host`
   own the announcement index?
3. Exact topic naming and whether the global index should be sharded.
4. Should `custody` be embedded or always referenced by `disclosureHash`?
5. How should private/encrypted announcements be represented without leaking
   liquidity?
6. What is the canonical adapter for `SwapAnnouncement`, given it is an
   in-memory routing hint rather than a signed manifest?
7. How are sequence watermarks persisted across devices for one publisher?

---

## 13. References

- RFC-039 — custody conformance.
- RFC-048 — primitive completeness; do not overload unrelated lookup messages.
- RFC-050 — Eefi product architecture.
- RFC-058 — custody modes and disclosure gate.
- RFC-059 — credit and discoverable liquidity (OpportunityManifest superseded
  by this envelope).
- RFC-032 — lookup stack.
- `packages/manifest/src/announcement.ts`
- `packages/liquidity-bond/src/announcement.ts`
- `packages/omnia-router/src/types.ts` — `SwapAnnouncement`
- `packages/lookup-protocol/src/messages.ts` — announce/query messages

---

## 14. Authorisation

Phase 1 is authorised: the generic envelope, signing/verification, topic
derivation, ranking and the pool projection adapter. No transport, registry,
host/connect method or MOKA mutation surface is authorised by this RFC yet.
Phase 2 requires an explicit follow-up after RFC-058 P1/P2.
