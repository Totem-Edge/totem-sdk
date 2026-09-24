# RFC-013: Wallet Self-Hosted Mode — Chain Provider Selection & Wallet-Side WOTS Lease

**Status:** Draft — not started
**Created:** 2026-09-24
**Authors:** Totem SDK Contributors
**Reviewers:** [Pending stakeholder assignment]
**Depends on:** RFC-008 (federated statechain — SE identity/lease), RFC-010 (TreeKey owner migration)
**Touches:** `extensions/totem-extension`, `extensions/totem-pwa-wallet`, `@totemsdk/chain-provider`, `@totemsdk/wots-lease`, `@totemsdk/storage`

---

## 1. Summary

The wallets default to Axia as their chain relay and (for WOTS key-use
coordination) their lease authority. This RFC makes **Axia the default but not
mandatory**: a user can opt out and point the wallet at their own local or remote
Minima node, and — in that mode — the wallet coordinates its own WOTS key use
from a **durable local record** via `@totemsdk/wots-lease`, anchored on-chain for
cross-instance safety.

This is a **self-hosted mode**, gated behind an explicit user choice, that moves
the chain relay and key-use coordination out of the Axia trust path. The Axia
SE co-signature (statechain) and registry remain separate concerns.

## 2. Motivation

- The extension already fetches a signed bootstrap from Axia and stores
  `AXIA_BASE`/`AXIA_PROJECT_ID`; ~10 background handlers read those directly.
  There is no supported way to use a personal node.
- The audit (`docs/audits/wallet-connect-parity-2026-09.md` §6.4) left the
  Axia-relay-vs-SDK-client question open. For chain reads/broadcast the clean
  answer is a **user-selectable `ChainStateProvider`**.
- `@totemsdk/wots-lease` already implements the local + on-chain + hybrid layers
  the SDK uses for its SE (RFC-008). The **wallet/owner** side still leases via
  Axia; RFC-010's TreeKey owner migration makes it possible to switch.

## 3. Goals

- Default remains **Axia relay**; opt-out to a user node with an explicit,
  reversible setting.
- Chain reads/broadcast resolved through a `ChainStateProvider`
  (`@totemsdk/chain-provider`), not hardcoded Axia REST.
- In self-hosted mode, WOTS key use coordinated by `LocalLeaseProvider`
  (durable local record) with the on-chain watermark as the cross-instance
  cursor, composed via `HybridLeaseProvider`.
- A browser durable `StorageAdapter` so `wots-lease` can persist in both wallets.
- Safe import/restore: never start below the true high-water mark.
- PWA parity with the extension.

## 4. Non-goals

- Removing Axia entirely. Axia remains the default relay, the SE registry, the
  hosted SE/lease service, and quota/telemetry.
- Replacing the statechain **SE co-signature** (that is RFC-008's SE; self-hosting
  it means running your own `se-server`).
- Multi-device federation/choice UX (that is RFC-008 Phase 2+/6).
- Any change to the connect method surface (that is the parity audit's T1–T5).

## 5. Current state (audit)

- **Chain access:** `extensions/totem-extension/src/core/config/bootstrap.ts`
  resolves `${AXIA_BASE}/v1/${AXIA_PROJECT_ID}`; `AxiaRpcClient` consumes it;
  background handlers read `AXIA_BASE` directly (~10 sites).
- **Lease:** the extension calls Axia `/v1/wots-hardened/prepare|finalize` for a
  leased signing slot (per `docs/totem-agent/01-architecture.md`).
- **Blockers:** `SecurityValidator` allow-lists only `__ALLOWED_HOSTS__`
  (production = Axia); `@totemsdk/storage` ships only `sqlite`/`file`/`memory`
  adapters (no browser adapter, which `wots-lease` needs).
- **Available now:** `@totemsdk/chain-provider` (`HostedProvider`,
  `MinimaRpcProvider`, `CompositeProvider`, `LookupClientProvider`);
  `@totemsdk/wots-lease` (`LocalLeaseProvider`, `OnchainWatermarkProvider`,
  `AxiaLeaseProvider`, `HybridLeaseProvider`).

## 6. Trust model & threat model

- **Default trust:** Axia relays chain data and coordinates leases (as today).
- **Self-hosted trust:** the user's node is the chain source; the wallet's local
  durable watermark is the key-use authority, anchored on-chain. Axia is
  bypassed for these paths.
- **Threats addressed:** a compromised/malicious relay returning false chain
  state; an unavailable Axia; single-relay correlation of a user's addresses.
- **Threats introduced:** a malicious/again-faulty user node returning false
  state (mitigated by on-chain proof verification where available —
  `verifyDeposit`, MMR proofs); a lost/rolled-back local watermark causing key
  reuse (mitigated §9); a hostile node URL (mitigated §11).
- **Invariant preserved:** key use is never reissued; the wallet never exceeds
  its TreeKey capacity; Axia is never silently used once the user opts out.

## 7. Chain provider selection

```ts
// extensions/*/src/core/config/chainProvider.ts
export type ChainProviderMode = 'axia' | 'minima-rpc' | 'composite';
export interface ChainProviderConfig {
  mode: ChainProviderMode;            // default 'axia'
  minimaRpcUrl?: string;              // http(s)://host:port (https remote)
  minimaRpcUser?: string;
  minimaRpcPass?: string;
  fallbackToAxia?: boolean;           // composite only
}
```

Resolver (shared shape in both wallets):

```ts
resolveChainProvider(): Promise<ChainStateProvider>
// axia       → new HostedProvider({ baseUrl: AXIA_BASE, apiKey })
// minima-rpc → new MinimaRpcProvider(new MinimaRpcClient({ url, user, pass }))
// composite  → new CompositeProvider(localProvider, hostedProvider, onFallback)
```

Route `getCoins`/`getCoin`/`getProof`/`getTip`/`broadcastTxPoW` through the
resolved provider. Axia-only routes (lease, quota, telemetry, SE registry) stay
on Axia unless §8 says otherwise.

## 8. Wallet-side WOTS lease selection

```ts
export type LeaseProviderMode = 'axia' | 'local' | 'hybrid';
export interface LeaseProviderConfig {
  mode: LeaseProviderMode;   // default 'axia'; 'hybrid' recommended for self-hosted
  threshold?: number;        // hybrid: value threshold for on-chain/quorum gating
}
```

- `axia` → `AxiaLeaseProvider` (current behaviour).
- `local` → `new LocalLeaseProvider(browserStorageAdapter, logger, deviceId)`.
  Durable per-device record; coordinates reserve → sign → commit/burn.
- `hybrid` (recommended) → `new HybridLeaseProvider({ local, onchain })` where
  `onchain = new OnchainWatermarkProvider(...)`; local-first, on-chain cursor for
  cross-instance/restore safety and for transactions above `threshold`.

The lease is namespaced by `treeId` (`WotsLeaseProvider.getLocalWatermark(treeId)`,
`publishWatermark(treeId)`), which maps to the owner's TreeKey (RFC-010) and the
address index space (`flatIndex(addressIndex, l1, l2)`).

**Explicit boundary:** the lease coordinates *key use*. The statechain **SE
co-signature** is a different signer and still requires an SE (Axia-hosted or a
self-hosted `se-server`, RFC-008). The UX must say so.

## 9. Freshness, seeding & import/restore

The safety property is "never reissue a used leaf". A local watermark alone is
insufficient across devices/restores.

- **On first run:** seed the local watermark to the known starting position
  (fresh wallet → 0 is safe only if the seed/address space is unspent).
- **On import/restore of an existing seed:** **never start at 0**. Seed from, in
  priority order: (1) the on-chain watermark cursor, (2) an exported watermark
  blob, (3) an operator-provided high-water mark. If none is available, **fail
  closed** and require the user to supply one.
- **Multiple active instances of the same seed** (extension + PWA, two browsers):
  local-only can collide. Use the on-chain cursor (`HybridLeaseProvider`) or
  declare and enforce a single-active-instance invariant (advisory lock).
- **Publication:** `publishWatermark(treeId)` advances the on-chain cursor; the
  wallet reads it on startup and before high-value signing.

## 10. Browser storage adapter (prerequisite)

`LocalLeaseProvider` needs a durable `StorageAdapter`. `@totemsdk/storage` has
only `sqlite`/`file`/`memory`.

- Add an IndexedDB adapter to `@totemsdk/storage` as a subpath
  (`@totemsdk/storage/idb`), usable by both the extension service worker and the
  PWA. It must declare `capabilities` and support conditional update (CAS) if
  `wots-lease`'s journal/snapshot primitives require it.
- The extension may alternatively wrap `chrome.storage.local` as a wallet-local
  adapter; the PWA uses IndexedDB (its `idb` dep already exists).
- Durability mode must be truthful (no silent downgrade): a volatile adapter is
  rejected for lease use, matching `wots-lease`/`@totemsdk/storage` conventions.

## 11. Security considerations

- **Allow-list consent:** `SecurityValidator` currently blocks non-Axia hosts.
  Self-hosted mode adds an explicit, user-consented exception: HTTPS required for
  remote hosts; `http` permitted only for `localhost`/`127.0.0.1`/`::1`; warn on
  plaintext remote. Never ship a build-time localhost bypass.
- **Credentials:** node user/pass are stored locally, never logged, never sent to
  Axia. Prefer OS/extension-secret storage where available.
- **Fail-closed:** if the watermark cannot be persisted, refuse to sign.
- **Single-writer:** serialize watermark mutations (the extension background is
  single-threaded per context; MV3 restarts require the durable CAS/lease store
  to hold the invariant).
- **Chain truth:** prefer proof-verified reads (`verifyDeposit`, MMR proofs) over
  trusting the node's word, where the SDK supports it.

## 12. UX

Extend the extension *Network Settings* (`BrutalistSettings.tsx`) and the PWA
*Settings* page:

- **Chain provider:** `Axia (recommended)` · `My own node` · `Advanced (node +
  Axia fallback)`.
  - Node fields (URL, optional user/pass) + **Test connection** (calls `getTip`).
- **WOTS key use:** `Managed by Axia` · `On this device (self-hosted)` ·
  `Hybrid (device + on-chain anchor)`.
  - Show watermark position, last publish, and health.
- **Explicit notice:** statechain SE co-signatures still require an SE (Axia or a
  self-hosted `se-server`).
- Reversible at any time; switching modes never rewrites key history.

## 13. PWA parity

The PWA uses the **same** config model, resolver, and IndexedDB-backed lease
store; only the Settings UI differs. Both wallets read/write the same
`toolchain`-agnostic config schema so a future shared package can host it.

## 14. Axia relationship

- Axia stays the **default** relay, lease authority, SE registry, and
  quota/telemetry source.
- In self-hosted mode Axia is bypassed for chain reads/broadcast and key-use
  coordination; it is still used for the SE (unless a self-hosted `se-server`).
- Axia's capability manifest (audit §6.1) should advertise the supported provider
  modes so dApps and wallets agree.

## 15. Dependency graph

```text
wallets → chain-provider → minima-rpc, core
wallets → wots-lease      → storage, core, txpow, lookup-protocol
wallets → storage/idb     (new browser adapter)
```

No cycles; Axia remains an external HTTP dependency, never a package dependency.

## 16. Phases

- **P0** — this RFC; confirm scope (chain paths only; SE remains Axia/self-hosted).
- **P1** — `@totemsdk/storage/idb` browser adapter (+ capabilities/CAS) and tests.
- **P2** — chain-provider config + resolver + route chain read/broadcast paths.
- **P3** — lease selection (`LocalLeaseProvider`/`HybridLeaseProvider`) + watermark
  seeding/import/on-chain anchor; commit-before-return; fail-closed.
- **P4** — extension Network Settings UX + test-connection + health.
- **P5** — PWA parity (shared config/resolver; Settings page).
- **P6** — tests: no-reuse across restart, restore-from-on-chain seeding, mode
  switch, allow-list consent, node-unreachable fallback, single-writer race.
- **P7** — Axia capability-manifest alignment; docs.

## 17. Resolved decisions

- Axia is the default; self-hosted is opt-in and reversible.
- Chain access goes through `@totemsdk/chain-provider`.
- Self-hosted key use goes through `@totemsdk/wots-lease` (`HybridLeaseProvider`
  recommended), never a bespoke watermark.
- Import/restore must seed from on-chain/exported watermark or fail closed.
- The SE co-signature is out of scope and remains a separate signer.
- Browser persistence is a new `@totemsdk/storage/idb` adapter.

## 18. Open questions

- **Q1** IndexedDB adapter in `@totemsdk/storage` vs a wallet-local adapter?
- **Q2** On-chain watermark publication cadence (per-signature vs batched)?
- **Q3** Single-active-instance enforcement mechanism (advisory lock + on-chain
  cursor vs on-chain only)?
- **Q4** Node credential storage: `chrome.storage.local` vs wallet-key sealing?
- **Q5** Does self-hosted mode also allow a self-hosted **SE** in the same UX, or
  is that RFC-008 Phase 6?

## 19. References

- `packages/chain-provider/src/{index,types}.ts`, `providers/{hosted,minima-rpc,composite}.ts`
- `packages/wots-lease/src/{index,local,hybrid,onchain}.ts`, `types.ts`
- `packages/storage/src/adapters/*`, `packages/storage/src/types.ts`
- `extensions/totem-extension/src/core/config/bootstrap.ts`,
  `.../core/security/SecurityValidator.ts`, `.../ui/popup/pages/BrutalistSettings.tsx`
- `docs/audits/wallet-connect-parity-2026-09.md` §6.4
- RFC-008, RFC-010; `docs/totem-agent/01-architecture.md`
- RFC-014 (wallet connect parity & shared execution bridge — how the chains families are served)
