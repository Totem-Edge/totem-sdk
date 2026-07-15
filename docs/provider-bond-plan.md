# `@totemsdk/provider-bond` — Build Plan v0.1

> **Status:** Building
> **Last updated:** 2026-07-11

## 1. What & Why

`@totemsdk/provider-bond` is a **small, production-shaped v0.1 provider trust package**. It proves, records, scores and filters providers — not manage liquidity pools or LP capital.

The package answers: Who is this provider? What service do they operate? Is their manifest signed? Is their manifest bound to an identity? What bond do they claim? Is there a proof attached? What probes/incidents exist? What score does the provider have? Should a client use this provider under a policy?

## 2. Dependencies

**Direct (4):** `@totemsdk/core`, `@totemsdk/manifest`, `@totemsdk/identity`, `@totemsdk/proof`

**Explicitly excluded:** omnia, omnia-router, omnia-factory, omnia-splice, kissvm, chain-provider, tx-builder, pubsub-transport, stream-transport, wots-lease, agent-policy, liquidity-bond

## 3. Module Structure

```
src/
  index.ts, types.ts, errors.ts, constants.ts, serialization.ts,
  manifest.ts, identity.ts, bond-proof.ts, probes.ts, incidents.ts,
  scoring.ts, policy.ts, registry.ts, memory-store.ts, __tests__/
```

## 4. Out of Scope for v0.1

KISSVM bond scripts, MAST branches, live Minima node verification, Omnia routing/splicing/settlement, productive bonded liquidity, LP deposits/shares/rewards/withdrawals, automatic slashing, DAO governance, TOTEM issuance, transport networking, wallet creation, seed management, address derivation.

## 5. Key Design Decisions

| Decision | Choice |
|----------|--------|
| Manifest format | Wrapper around `@totemsdk/manifest` `EdgeServiceManifest` + `SignedManifest<T>` |
| Identity binding | Use `@totemsdk/identity` `bindManifestToIdentity()` / `verifyManifestIdentity()` |
| Bond proofs | Use `@totemsdk/proof` for `totem-proof` type; manual/declared verified locally |
| Hashing | `F`, `hashObject`, `hashAllObjects` from `@totemsdk/core` |
| Verify results | `ProviderBondVerifyResult { ok, reason?, code?, requiresLiveVerifier? }` |
| Registry | Pure functions over `ProviderBondRegistryState` (Record-based, not Map) |
| Store | `MemoryProviderBondStore` class, may mutate internal memory, returns cloned snapshots |
| Serialization | BigInt-safe JSON with deterministic key sorting |
| Scoring | Pure function, injected `now`/`height` |
| Transport | None in v0.1 |

## 6. Full spec at top of this document (the build prompt)
