# Canary findings

Generated 2026-11-12T06:45:30.867Z. 4 findings, 4 open.

sdk-defect: 3 · sdk-gap: 1

| id | severity | kind | status | packages | title |
|---|---|---|---|---|---|
| `CAN-001` | high | sdk-defect | open | `@totemsdk/omnia`, `@totemsdk/omnia-host`, `@totemsdk/tx-builder` | Channel funding draft silently drops the unspent part of the funding coin |
| `CAN-002` | high | sdk-defect | open | `@totemsdk/proof`, `@totemsdk/manifest` | Manifest proofs are not bound to the manifest they attest |
| `sdk-gap:integration-gates` | medium | sdk-gap | open | `@totemsdk/agent-policy`, `@totemsdk/authority`, `@totemsdk/chain-provider`, `@totemsdk/connect`, `@totemsdk/decision`, `@totemsdk/edge`, `@totemsdk/governance`, `@totemsdk/identity`, `@totemsdk/intelligence`, `@totemsdk/kissvm`, `@totemsdk/liquidity-bond`, `@totemsdk/lookup-client`, `@totemsdk/lookup-node`, `@totemsdk/lookup-protocol`, `@totemsdk/manifest`, `@totemsdk/mcp-server`, `@totemsdk/omnia-factory`, `@totemsdk/omnia-host`, `@totemsdk/omnia-pool`, `@totemsdk/omnia-router`, `@totemsdk/omnia-vtxo`, `@totemsdk/p2p-hub`, `@totemsdk/pear`, `@totemsdk/provider-bond`, `@totemsdk/minima-rpc`, `@totemsdk/pubsub-transport`, `@totemsdk/qvac`, `@totemsdk/realtime`, `@totemsdk/recursive-mast`, `@totemsdk/root-identity`, `@totemsdk/se-server`, `@totemsdk/server`, `@totemsdk/storage`, `@totemsdk/stream-transport`, `@totemsdk/tx-builder`, `@totemsdk/txpow`, `@totemsdk/wallet-adapter`, `@totemsdk/wots-lease`, `@totemsdk/entity`, `@totemsdk/eefi`, `@totemsdk/replication` | 41 publishable packages declare no test:integration gate |
| `CAN-003` | low | sdk-defect | open | `@totemsdk/omnia-host`, `@totemsdk/lookup-node` | Two unit suites exceed Jest's 5s default timeout under load |

Per-finding agent briefs are in `agent/`. Each one is self-contained.
