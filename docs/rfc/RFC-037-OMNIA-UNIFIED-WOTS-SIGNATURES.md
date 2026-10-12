# RFC-037 — Omnia channels use the wallet's unified WOTS scheme

Status: Phase 1 landed
Supersedes/relates: RFC-034 §9 A4 (signer bridge), RFC-013 (WOTS leases), RFC-020 (tree keys)

## 1. Problem

RFC-034 Phase A4 ("bridge the wallet's signer/lease into the Omnia client")
surfaced a scheme mismatch. Omnia verifies channel/state signatures with the
**flat** primitive `wotsVerifyDigest(sig, digest, pk)` (`omnia/src/sign.ts`,
`close-package.ts`, and the injectable defaults in `omnia-factory`/`omnia-splice`),
and `@totemsdk/omnia-host`'s signer produces flat `wotsSign` signatures from
`derivePerAddressSeed`.

Wallets (extension + PWA) sign with a **hierarchical** `TreeKey`
(`createUnifiedChildTreeKey` → `TreeKey.sign` → `serializeTreeSignature`, an
L1→L2→L3 proof bundle). Their address identity is the tree-root public key — which
is exactly what the on-chain `MULTISIG(2 pkA pkB)` eltoo script already embeds
(`omnia/src/script.ts`). So the chain already assumes the wallet's scheme; only the
*off-chain* co-signature verification was flat.

Two mismatches:
1. **Derivation** — wallets use unified `deriveUnifiedChildSeed`; omnia-host uses
   the deprecated legacy `derivePerAddressSeed`.
2. **Signature format** — hierarchical `TreeSignature` vs flat 1088-byte `wotsSign`.

## 2. Decision

Omnia channel signatures **must use the wallet's unified WOTS scheme**. A channel
signature is a serialized `TreeSignature`; it is verified with
`verifyTreeSignature(publicKeyDigest, digest, signature)` where `publicKeyDigest`
is the party's tree-root public key — the same key the on-chain `MULTISIG` script
uses. This makes one signer produce signatures usable both off-chain (state
co-signing) and on-chain (settlement witness), with no second key.

## 3. Design

New `omnia/src/wots.ts`:

```ts
export const FLAT_WOTS_SIGNATURE_LENGTH = 1088;
export function verifyChannelSignature(
  signature: ChannelSignature,
  digest: Uint8Array,
  publicKeyDigest: string,   // 64 hex chars (32-byte root pubkey)
): boolean;
```

The **advertised `publicKeyDigest` selects the scheme**, not a heuristic on the
signature bytes:

- tree root (wallet) ⇒ `deserializeTreeSignature` + `verifyTreeSignature`;
- flat leaf pubkey (legacy `omnia-host`) ⇒ `wotsVerifyDigest`.

This dual-accept keeps the current host verifying while wallets move to tree
signatures, and cannot be downgraded: a flat signature cannot verify against a
tree root and a tree signature cannot verify against a flat leaf pubkey.

`sign.ts` (`verifyStateSignature`) and `close-package.ts`
(`verifyClosePackage`, `verifyPartialClosePackage`) now route through
`verifyChannelSignature`. `ChannelSignature`'s doc and `ChannelSigner.sign`'s
contract now state the canonical hierarchical form.

Security invariants are unchanged: one-time indices still come from the
`WotsLeaseProvider` (RFC-013); verification fails closed on any error.

## 4. Phasing

- **Phase 1 — landed.** `verifyChannelSignature` (dual-accept); `sign.ts`,
  `close-package.ts`, `types.ts` updated; exported from `@totemsdk/omnia`. Covered
  by `omnia/src/__tests__/wots.test.ts` (tree verify, tamper rejection, flat
  fallback, scheme isolation).
- **Phase 2.** Wallet hosts emit tree signatures: the extension/PWA signer bridge
  advertises the unified tree-root pubkey and returns `serializeTreeSignature`.
  Switch the `omnia-factory` / `omnia-splice` default `verify` callbacks to
  `verifyChannelSignature`. Wire `createOmniaRelayClient` signing material.
- **Phase 3 — landed.** Everything uses the unified child TreeKey, no migration
  (pre-release). `@totemsdk/omnia-host`'s channel signer derives
  `createUnifiedChildTreeKey` and returns serialized `TreeSignature`s; its
  identity/manifest address is the same tree root. `@totemsdk/manifest`
  (`signManifest`/`verifyManifest`) and `@totemsdk/edge`'s
  `createEdgeServiceManifest` sign/verify with the TreeKey. The flat fallback is
  retired from `verifyChannelSignature` (tree-only). Tests: omnia 125,
  omnia-host 51, omnia-relay 23, omnia-factory 84, omnia-splice 72, omnia-pool 37,
  manifest 61, edge 183, edge-adapters 102, identity 36, proof 25, provider-bond 96.

## 5. Acceptance

- A wallet `TreeKey` signature over a channel digest verifies against the tree-root
  pubkey; a tampered digest fails; a flat signature does not verify against a tree
  root and vice-versa. (`wots.test.ts`)
- `omnia.test.ts` and `verify:wallets` stay green.
- Every Phase 2 producer advertises its tree-root pubkey on `ChannelParticipant`.

## 6. Risks

| Risk | Mitigation |
|---|---|
| Flat fallback left in place too long | Phase 3 removes it; the `publicKeyDigest` gate prevents cross-scheme acceptance |
| Derivation drift between wallet and host | Phase 3 unifies both on `createUnifiedChildTreeKey`; parity fixtures |
| On-chain script must match off-chain root | Both use `publicKeyDigest` = tree-root pubkey (already the case) |
