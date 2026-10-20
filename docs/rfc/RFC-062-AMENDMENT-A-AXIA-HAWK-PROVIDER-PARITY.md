# RFC-062 Amendment A — Axia/Hawk Provider Parity and Mode Isolation

**Status:** Draft — P0 implementation addendum
**Priority:** P0
**Created:** 2026-10-21
**Authors:** Totem SDK Contributors
**Depends on:** RFC-062 (Node/Extension Pairing), RFC-013 (Wallet Self-Hosted Mode), RFC-014 (Wallet Connect Parity), RFC-061 (Custody Enforcement Boundaries)
**Touches:** `extensions/totem-extension`, `chain-provider`, `wots-lease`, `omnia-relay`, `omnia-host`, `p2p-hub`, pairing storage, dApp balance/portfolio contract

> **Positioning.** RFC-062 introduced a paired local node and a capability map.
> This addendum defines how the extension actually behaves in the two supported
> deployment modes. **Axia mode must remain exactly as it is today. Hawk mode must
> talk only to the paired node and its advertised services.** The extension must
> never mix the two silently.

---

## 1. Summary

This amendment decides:

1. **Provider mode is explicit.** `providerMode = 'axia' | 'hawk'`; it is not
   inferred from the presence of a node URL.
2. **Axia mode is frozen.** Existing Axia endpoints, dApp contract, telemetry,
   quota behaviour and error handling remain unchanged.
3. **Hawk mode is capability-routed.** Chain, lease, Omnia, P2P, realtime and
   indexer each resolve independently from the pairing capability map.
4. **No silent fallback.** A missing Hawk capability is disabled or shown as
   unavailable. Axia is used only if the user explicitly enables fallback.
5. **P2P never falls back.** Axia has no equivalent; Hawk mode uses `p2p-hub`.
6. **The extension owns the provider boundary.** Direct `AxiaRpcClient` and
   `AXIA_BASE` calls outside the Axia adapter are removed from wallet paths.
7. **dApps must not be forced to call Axia in Hawk mode.** A provider-neutral
   balance/portfolio surface is defined; the existing Axia dApp contract remains
   valid in Axia mode.
8. **Mode isolation is tested.** Contract tests run the same wallet operations
   against both adapters, and request traces assert that no cross-mode calls occur.

---

## 2. Motivation

RFC-062 currently pairs a node and stores a capability map, but the extension still
contains Axia-specific code in the wallet, bootstrap, lease, events, telemetry and
quota paths. Switching only the chain URL is not enough:

- Axia is an indexer and signing-coordination service, not just an RPC endpoint.
- Node RPC command names and response shapes differ from Axia REST.
- Some Axia features (portfolio, realtime, quota, project bootstrap) may have no
  node equivalent.
- dApps are currently told to fetch balances from Axia; in Hawk mode that would
  silently send them back to Axia.

Without a provider boundary, the result is a hybrid state with unpredictable
failures and privacy leaks.

---

## 3. Goals and non-goals

**Goals**

- Preserve Axia mode byte-for-byte at the API-consumer level.
- Make Hawk mode work for core wallet operations against a local node.
- Route by capability, with visible and explicit fallback.
- Keep one code path per adapter, not conditional logic spread through the wallet.
- Prove parity and isolation with automated tests and request traces.

**Non-goals**

- Reimplementing the Axia indexer inside a node.
- Changing the Minima node RPC protocol.
- Making Hawk mode the default.
- Shipping hosted custody/MCP changes (RFC-061) as part of this amendment.
- Adding remote/public node pairing (RFC-062 remains loopback-first).

---

## 4. Definitions

- **Provider mode** — explicit deployment selection: `axia` or `hawk`.
- **Capability** — a feature the paired node advertises: `chain`, `lease`,
  `omnia`, `p2p`, `realtime`, `indexer`.
- **Adapter** — implementation of a provider interface for one mode.
- **Capability routing** — resolving each feature independently from the pairing
  map (`core/providers/routing.ts`).
- **Explicit fallback** — user-visible opt-in to use Axia for a missing Hawk
  capability.
- **Axia mode** — existing hosted/indexer mode; unchanged.
- **Hawk mode** — paired local-node mode; node RPC + `omnia-host` + `p2p-hub`.

---

## 5. Decisions

### A1 — Explicit mode selection

`providerMode` is a top-level wallet setting.

- Default: `axia`.
- Pairing a node sets `hawk` only after the user confirms the pairing screen.
- Unpairing/revoking the node returns to `axia` only with user confirmation.
- A persisted node URL without a paired identity does not enable Hawk mode.

### A2 — Axia mode is frozen

In Axia mode:

- `AxiaRpcClient`, `AXIA_BASE`, `AXIA_PROJECT_ID`, bootstrap, telemetry, quota and
  announcements behaviour are unchanged.
- The extension makes no node RPC or `p2p-hub` calls.
- Existing dApp guidance (“fetch balance/portfolio from Axia”) remains valid.
- Existing tests and request snapshots must pass without modification.

### A3 — Hawk mode is capability-routed

In Hawk mode the extension builds a `ProviderRouting` from the stored pairing:

| Capability | Hawk source | If missing |
|---|---|---|
| `chain` | paired node RPC | disabled unless explicit Axia fallback |
| `lease` | local/hybrid `wots-lease` | disabled unless explicit Axia fallback |
| `omnia` | `omnia-host` control/relay | disabled unless explicit Axia fallback |
| `p2p` | `p2p-hub` | disabled; no Axia fallback |
| `realtime` | node-advertised WS | polling/disabled or explicit fallback |
| `indexer` | node-advertised indexer | disabled or explicit fallback |

The routing module remains the single source of truth; callers must use
`assertRoute()` and surface the reason.

### A4 — No silent fallback

- Fallback requires an explicit user action and is recorded in settings.
- A missing capability must produce a typed `UNAVAILABLE` error, not an Axia call.
- P2P has no fallback path.
- If the node is offline, Hawk mode shows node-unavailable; it does not silently
  switch to Axia.

### A5 — Provider interfaces and registry

Introduce the boundary once and inject it into wallet/bootstrap code:

```ts
export interface ChainDataProvider {
  getTip(): Promise<Tip>;
  getBalance(address: string): Promise<Balance[]>;
  getCoins(query: CoinQuery): Promise<Coin[]>;
  getToken(tokenId: string): Promise<TokenInfo | null>;
  getTransaction(id: string): Promise<Transaction | null>;
  broadcast(signed: Uint8Array): Promise<BroadcastResult>;
}

export interface LeaseProviderPort {
  reserve(request: LeaseRequest): Promise<LeaseReservation>;
  commit(id: string, txId: string): Promise<void>;
  burn(id: string, reason: string): Promise<void>;
  watermark(): Promise<Watermark | null>;
}

export interface EventsProviderPort {
  subscribeBalance(address: string, handler: (balance: Balance[]) => void): () => void;
  subscribeAnnouncements(handler: (event: unknown) => void): () => void;
}

export interface OmniaProviderPort {
  connect(): Promise<void>;
  hostControlUrl?: string;
  relayUrl?: string;
}

export interface P2PProviderPort {
  connect(): Promise<void>;
  publish(topic: string, payload: Uint8Array): Promise<void>;
  subscribe(topic: string, handler: (payload: Uint8Array) => void): () => void;
}

export interface TelemetryProviderPort {
  recordQuota(headers: Headers): void;
  recordEvent(event: unknown): void;
}
```

Adapters:

- `AxiaAdapter` — wraps the existing `AxiaRpcClient`, bootstrap lookup, telemetry,
  quota and announcements without rewriting their logic.
- `HawkAdapter` — Minima RPC via `chain-provider`, local/hybrid `wots-lease`,
  `omnia-host` control/relay, `p2p-hub`.
- `NullAdapter` — explicit unavailable for missing Hawk capabilities.

A `ProviderRegistry` is built once from `providerMode` + `ProviderRouting` and
injected into wallet/bootstrap services.

### A6 — Wallet core uses the registry

- `wallet.ts` no longer constructs `AxiaRpcClient` directly; it receives
  `ChainDataProvider` + `LeaseProviderPort`.
- Direct `AXIA_BASE` reads are removed from wallet paths and live only inside the
  Axia adapter.
- `AxiaRpcClient` remains unchanged behind the adapter.
- Hawk wallet operations use the node adapter for tip, balance, coins, tokens,
  transaction lookup, broadcast and lease.
- Errors are adapter-specific but share error codes (`UNAVAILABLE`, `UNAUTHORIZED`,
  `NODE_OFFLINE`, `LEASE_EXHAUSTED`).

### A7 — dApp balance/portfolio contract

The current dApp contract says balances come from Axia. That cannot be the Hawk
mode answer.

Decision:

- Axia mode keeps the existing contract.
- Hawk mode exposes provider-neutral reads:
  - `TOTEM_GET_BALANCE` (new), and/or
  - `TOTEM_GET_COINS` (already present), plus optional `TOTEM_GET_PORTFOLIO`.
- The wallet capability manifest advertises whether balance is wallet-served or
  requires an external indexer.
- dApps must use the advertised source; they must not hardcode Axia in Hawk mode.
- If the node has no portfolio/indexer capability, portfolio is `UNAVAILABLE`
  unless explicit fallback is enabled.

### A8 — Telemetry and quota

- Axia mode: unchanged.
- Hawk mode: telemetry/quota are disabled by default; no Axia telemetry calls.
- If an operator wants telemetry, it must be explicitly configured; quota UI is
  hidden when no Axia quota source exists.
- Connection monitoring checks the selected provider (node health vs Axia health),
  not both.

### A9 — Lease and watermark

- Axia mode: Axia lease + watermark unchanged.
- Hawk mode: local/hybrid lease; on-chain watermark only when advertised by
  pairing.
- Lease/journal failures never fall back to Axia.
- Multi-tab/concurrent signing and restart recovery must be tested in both modes.

---

## 6. Inventory

Implementation starts with a complete Axia touchpoint inventory:

| Area | Files / concerns | Hawk equivalent |
|---|---|---|
| Bootstrap/config | `bootstrap.ts`, `AXIA_BASE`, `AXIA_PROJECT_ID` | pairing identity/capabilities |
| Wallet core | `AxiaRpcClient`, `wallet.ts` | node `chain-provider` adapter |
| Lease/watermark | `selfHosted.ts`, `watermark.ts` | local/hybrid lease |
| Events | announcements WS, realtime proxy | node WS or polling/disabled |
| Omnia | relay/coordination | `omnia-host` + `p2p-hub` |
| Telemetry | `telemetry.ts`, token cache | disabled or operator-configured |
| Quota | `QuotaTracker`, UI quota state | disabled/hidden |
| Connection monitor | Axia health checks | node health checks |
| dApp contract | balance/portfolio docs | provider-neutral wallet methods |
| P2P | none | `p2p-hub` |

The inventory is a merge-blocking deliverable for the refactor.

---

## 7. Work plan

### Phase 1 — Inventory + interfaces (2–3 days)

- Produce the touchpoint inventory.
- Add provider interfaces, registry and `AxiaAdapter` wrapping existing code.
- Add request-trace fixtures for Axia mode.
- No behaviour change.

### Phase 2 — Chain + lease Hawk adapters (3–5 days)

- Implement node tip/balance/coins/token/tx/broadcast.
- Implement local/hybrid lease and watermark.
- Contract tests against fake node + real node.
- Validate command/response mapping; document gaps.

### Phase 3 — Wallet injection (2–3 days)

- Inject registry into wallet/bootstrap.
- Remove direct Axia construction/reads outside the Axia adapter.
- Run the existing Axia suite unchanged.

### Phase 4 — Events, Omnia, P2P (3–4 days)

- Route realtime/announcements by capability.
- Route Omnia to `omnia-host` and P2P to `p2p-hub`.
- Ensure Axia mode never starts a swarm or calls a node.

### Phase 5 — dApp contract + telemetry/quota (2–3 days)

- Add provider-neutral balance/portfolio reads.
- Advertise the balance source in the capability manifest.
- Disable/hide Axia telemetry/quota in Hawk mode; explicit fallback only.

### Phase 6 — Isolation + E2E (2–3 days)

- Cross-mode request assertions.
- Pair/unpair/revoke/offline/fingerprint tests.
- Real node + PIPE hub E2E.
- Remove the temporary flag after parity sign-off.

**Estimate:** 14–21 engineer-days, roughly 3–4 weeks for one engineer.

---

## 8. Test plan

### Axia mode

- Full existing extension suite passes unchanged.
- Request snapshots show only Axia endpoints.
- No node RPC, no `p2p-hub`, no local pairing calls.
- Telemetry/quota/announcements unchanged.

### Hawk mode

- Chain, lease, Omnia and P2P calls go to the paired node only.
- No `api.axia.to`/`telemetry.axia.to` calls unless explicit fallback is enabled.
- Node offline → `NODE_OFFLINE`, no Axia fallback.
- Missing capability → `UNAVAILABLE` with reason; P2P always disabled if absent.
- Revoked/rotated token → re-pair required.
- Fingerprint mismatch → node disabled.

### Parity suite

Run the same operations against `AxiaAdapter` (mock Axia) and `HawkAdapter`
(mock node):

- tip, balance, coins, token lookup, tx lookup, broadcast;
- lease reserve/commit/burn, restart recovery, concurrent signing;
- wallet create/import/unlock, send, token send;
- Omnia connect/prepare/approve;
- P2P publish/subscribe;
- dApp balance/portfolio source negotiation.

---

## 9. Acceptance criteria

1. Axia mode has no node/P2P calls and its existing tests/snapshots pass.
2. Hawk mode has no Axia calls except an explicitly enabled, user-visible fallback.
3. Every Hawk feature resolves through `ProviderRouting`; missing capabilities are
   typed and visible.
4. P2P never falls back to Axia.
5. Wallet core no longer constructs `AxiaRpcClient` or reads `AXIA_BASE` directly.
6. dApps can obtain balance/portfolio in Hawk mode without calling Axia.
7. Lease/watermark behaviour is correct across restart and concurrency in both modes.
8. Telemetry/quota are disabled or explicitly configured in Hawk mode.
9. Pairing revocation and fingerprint changes fail closed.
10. Real-node E2E passes for core wallet, Omnia and P2P operations.

---

## 10. Open questions

1. **Balance contract:** new `TOTEM_GET_BALANCE` vs extending `TOTEM_GET_ACCOUNTS`
   vs a node-side Axia-compatible read endpoint.
2. **Portfolio/indexer:** accept `UNAVAILABLE` in Hawk v1, or require a local
   indexer adapter before shipping?
3. **Realtime:** node WS bridge, polling, or disabled in Hawk v1?
4. **Telemetry:** fully disabled in Hawk mode, or operator-configurable?
5. **Fallback UX:** per-capability toggle, one global “allow Axia fallback”, or
   prompt-on-demand?
6. **Axia adapter extraction:** keep `AxiaRpcClient` as-is internally, or split its
   read/lease/quota surfaces into smaller adapters?

---

## 11. Out of scope

- Hosted custody/MCP enforcement (RFC-061).
- Remote/public pairing and 2FA (RFC-062).
- Rewriting the Axia indexer.
- Changing Minima node RPC.
- S8 three-host/cross-token work.

---

## 12. References

- RFC-062 — Node/Extension Pairing and Local-Node Provisioning
- RFC-013 — Wallet Self-Hosted Mode
- RFC-014 — Wallet Connect Parity
- RFC-061 — Custody Enforcement Boundaries
- `core/providers/routing.ts` — capability routing
- `core/config/selfHosted.ts` — chain/lease selection
- `core/api/AxiaRpcClient.ts` — current Axia adapter surface
