# RFC-037 Amendment A — Omnia channel identity (root-identity anchor)

Status: Proposed
Relates: RFC-037 (unified WOTS signatures), RFC-013 (WOTS leases), RFC-014 §6.3

## 1. Context

RFC-037 Phase 2 binds a wallet's unified WOTS `TreeKey` to Omnia's
`ChannelSigner`/`ChannelParticipant` (`@totemsdk/omnia-relay`'s
`createWalletChannelSigningMaterial`). That leaves open **which key is the
wallet's Omnia identity**, and how a counterparty recognizes it.

The repo has a canonical identity: `@totemsdk/root-identity`'s
`UnifiedIdentityWallet` — the unified root TreeKey (`createUnifiedRootTreeKey`),
exposed as `getRootPublicKey()`/`getRootAddress()`, `signFromRoot()`, and
`proveOwnership()`. It is the wallet-wide identity already used by SE identity,
lookup identity, manifests (`rootIdentityProof`), and the extension's ownership
proof. `@totemsdk/identity` supplies the id/schema layer (`computeIdentityId`,
claims).

**Constraint.** The root TreeKey is *never a spend key* (`core/src/treekey.ts:923`,
`UnifiedIdentityWallet.ts:143`). An Omnia channel script is
`MULTISIG(2 pkA pkB)` — a spend output — and settlement signs that spend. So the
root key must **not** be embedded as the channel participant key: it would breach
the non-spend invariant and share the root key's one-time WOTS watermark with
attestation/ownership use (leaf reuse).

## 2. Decision

Three separated roles:

| Role | Key | Value |
|---|---|---|
| Wallet identity (stable, recognizable) | unified root identity | `partyId` = `computeIdentityId('wallet', rootAddress)` |
| Channel signing key (spend-capable) | per-address **child** TreeKey | `publicKeyDigest` = child tree-root pubkey (lowercase, `0x`-prefixed) |
| Binding | root-identity **ownership proof** | `UnifiedIdentityWallet.proveOwnership([addressIndex])` |

The channel key is a child address key (as today); the root identity **anchors**
it by signing the child's public key, so any counterparty can verify the channel
key is controlled by the wallet's root identity — without the root key ever
entering a script. This mirrors `se-server/src/seIdentity.ts`.

### 2.1 Address switching (identity is stable, the key rotates)

Because the root identity anchors a whole family of **hierarchically derived
child addresses** (`createUnifiedChildTreeKey(baseSeed, i)`, `i ∈ 0..63`), the
wallet can present a **different channel key per channel** while the identity
stays constant:

- `partyId` = identity id — **unchanged** as the user switches active address.
- `publicKeyDigest` / `addressIndex` = the child address used for **that** channel
  (typically the wallet's active address at open time), with an ownership proof
  covering that index.

So "switch address" simply means *new* channels are anchored to a different
child key; the counterparty still resolves them to the same wallet identity. An
already-open channel keeps the child key it was opened with (changing it is a
channel-level operation, out of scope). This is the reason `partyId` is the
identity id rather than the child digest — the child digest is per-channel, the
identity is per-wallet.

## 3. Schema

Add an optional identity block to `ChannelParticipant` (`omnia/src/types.ts`):

```ts
export interface ChannelIdentity {
  /** `@totemsdk/identity` id: `totem:id:wallet:<hex>`. */
  id: string;
  rootAddress: string;
  rootPublicKey: string;      // lower-case hex (no 0x), as root-identity emits
  /** `UnifiedIdentityWallet.proveOwnership([addressIndex])`. */
  ownershipProof: OwnershipProof;   // from @totemsdk/root-identity
}

export interface ChannelParticipant {
  partyId: string;            // = identity.id when identity is present
  publicKeyDigest: string;    // child tree-root pubkey ('0x' + lower-case hex)
  addressIndex: number;
  settlementAddress?: string;
  relayEndpoint?: string;
  identity?: ChannelIdentity; // RFC-037-A
}
```

Hex alignment: `OwnershipProof.childPublicKeys` are lower-case hex **without**
`0x`; `publicKeyDigest` is `0x`-prefixed. Verification normalises both sides
(strip `0x`, lower-case).

## 4. Verification

New `verifyChannelParticipantIdentity(participant): { valid: boolean; errors: string[] }`
in `@totemsdk/omnia`:

1. If `identity` is absent → `valid: true` (migration: identity is optional).
2. `UnifiedIdentityWallet.verifyOwnershipProof(identity.ownershipProof)` must be true.
3. `identity.ownershipProof.rootPublicKey` / `rootAddress` must equal
   `identity.rootPublicKey` / `identity.rootAddress`.
4. `participant.publicKeyDigest` (normalised) must be in
   `identity.ownershipProof.childPublicKeys`.
5. `identity.id === computeIdentityId('wallet', identity.rootAddress)`.

A counterparty MAY require identity for new channels (policy flag); during the
RFC-037 migration it defaults to optional.

## 5. Phasing

- **A1 — schema + verification.** `ChannelIdentity` on `ChannelParticipant`,
  `verifyChannelParticipantIdentity`, exported from `@totemsdk/omnia`; unit tests
  (valid proof, digest-not-in-proof, tampered root signature, missing identity).
- **A2 — host wiring.** Extension/PWA build the participant on unlock via
  `UnifiedIdentityWallet` (root info + `proveOwnership([addressIndex])`) and the
  child-key signer from `createWalletChannelSigningMaterial`; pass it to
  `createOmniaRelayClient`. Gated to self-hosted lease mode (Axia mode has no
  lease provider ⇒ mutations stay `UNSUPPORTED`).
- **A3 — enforcement.** Optional "require identity" policy at channel
  open/accept; retire the identity-optional default for new channels.

## 6. Security

- **Root key never in a script.** The channel script embeds only the child key;
  the root key only signs the off-chain ownership message.
- **No leaf reuse.** Ownership proofs consume root TreeKey leaves via
  `signFromRoot()`; the root key's `uses` counter must be persisted and, where
  multiple proofs may race, the leaf must be leased (RFC-013). A1 tests pin the
  proof format; A2 must route root-leaf allocation through the lease/watermark.
- **Fail closed.** Any malformed/mismatched proof ⇒ invalid participant.
- **Identity ≠ hosted identity hash.** The clients' `X-User-Identity-Hash` is
  `SHA3-256(TreeKey(baseSeed).getRootPublicKey())` — a *different* key from
  `createUnifiedRootTreeKey`. Do not conflate; Omnia identity uses the unified
  root identity. (The client-hash inconsistency is tracked separately.)

## 7. Open questions

- **Resolved:** `partyId` is the identity id (not the child digest) so the wallet
  identity is stable across address switching (§2.1); `publicKeyDigest` stays the
  per-channel on-wire key.
- Which address a *new* channel uses by default: the wallet's **active** address
  at open time, or a dedicated Omnia address? (Leaning: active address, so the
  settlement address matches what the user sees.)
- Root-leaf leasing for ownership proofs: reuse the wallet's existing lease
  provider with a dedicated `treeId` (e.g. `omnia-identity`) or a monotonic
  persisted root cursor?
