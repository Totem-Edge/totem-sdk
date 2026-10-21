# Axia touchpoint inventory (RFC-062 Amendment A, Phase 1)

The Axia mode must stay unchanged. This inventory is the refactor checklist for
moving each surface behind an adapter.

| Area | Current implementation | Hawk target | Fallback |
|---|---|---|---|
| Bootstrap/config | `core/config/bootstrap.ts`, `AXIA_BASE`, `AXIA_PROJECT_ID` | pairing identity/capabilities | Axia only in Axia mode |
| Wallet balance | `wallet.ts` → `AxiaRpcClient.call('balance')` | node `chain-provider` balance/coins | explicit only |
| Wallet history | `wallet.ts` → `call('history')` | node tx/search | explicit only |
| WOTS status | `wallet.ts` → `call('wots/status')` | local lease health | explicit only |
| Watermark | `AxiaRpcClient.getWatermark` | local/hybrid lease watermark | explicit only |
| Lease | `selfHosted.ts`, Axia managed | `wots-lease` local/hybrid | explicit only |
| Broadcast/send | Axia API / background paths | node RPC `send`/`txnmine` | explicit only |
| Realtime/announcements | `realtime`, `wsSubscriber` | node WS or polling | disabled/explicit |
| Omnia | relay/coordination | `omnia-host` + `p2p-hub` | explicit only |
| P2P | none | `p2p-hub` | never |
| Telemetry | `telemetry.ts`, token cache | disabled/operator configured | disabled |
| Quota | `QuotaTracker`, quota UI | none | hidden |
| Connection monitor | Axia health | node health | selected mode only |
| dApp balances | Axia API per docs | wallet/node-neutral methods | defined in Amendment A §A7 |

Phase 1 adds:
- `core/providers/contracts.ts`
- `core/providers/axiaAdapter.ts`
- `core/providers/routing.ts`

The remaining Axia call sites move behind the registry in Phases 2–3.
