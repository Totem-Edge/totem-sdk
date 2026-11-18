# Canary findings

Generated 2026-11-18T06:04:42.000Z. 44 findings, 25 open.

sdk-defect: 38 · environment-blocked: 1 · sdk-gap: 5

| id | severity | kind | status | packages | title |
|---|---|---|---|---|---|
| `CAN-006` | critical | sdk-defect | open | `@totemsdk/omnia-host` | A channel is stored as active and submit reports success before the counterparty has acknowledged |
| `CAN-007` | critical | sdk-defect | in-progress | `@totemsdk/omnia-host` | Unsolicited SPLICE_FINALIZED and VC_FINALIZED messages overwrite trusted channel state |
| `CAN-010` | critical | sdk-defect | in-progress | `@totemsdk/omnia-host` | FACTORY_FUNDING_REQUEST signs an arbitrary peer-supplied digest |
| `CAN-018` | critical | sdk-defect | in-progress | `@totemsdk/omnia-host`, `@totemsdk/omnia-factory` | Factory proposal still signs a peer-controlled commitment |
| `OMN-001` → `CAN-019` | critical | sdk-defect | open | `@totemsdk/omnia-host`, `@totemsdk/omnia-factory` | Peer-scoped finalization stores peer-supplied factory, channel and splice state |
| `CAN-024` | critical | sdk-defect | fixed | `@totemsdk/omnia`, `@totemsdk/omnia-host`, `@totemsdk/chain-provider`, `@totemsdk/core` | Omnia writes atom amounts with MiniNumber scale 0, encoding channel values 10^44 times too large |
| `OMN-003` | critical | sdk-defect | open | `@totemsdk/omnia-vtxo` | A transferred VTXO keeps the previous owner's exit entitlement |
| `OMN-008` | critical | sdk-defect | open | `@totemsdk/omnia-vtxo` | Vesting policy never enforces the vested amount before the end block |
| `CAN-001` | high | sdk-defect | fixed | `@totemsdk/omnia`, `@totemsdk/omnia-host`, `@totemsdk/tx-builder` | Channel funding draft silently drops the unspent part of the funding coin |
| `CAN-002` | high | sdk-defect | fixed | `@totemsdk/proof`, `@totemsdk/manifest` | Manifest proofs are not bound to the manifest they attest |
| `CAN-004` | high | sdk-defect | open | `@totemsdk/omnia`, `@totemsdk/omnia-host` | Non-custodial channel open races the chain: the acceptor validates the funding coin before it can be mined |
| `CAN-008` | high | sdk-defect | in-progress | `@totemsdk/omnia-relay` | Forwarder signs the outgoing HTLC before the link is durable |
| `CAN-009` | high | sdk-defect | in-progress | `@totemsdk/omnia-relay` | Relay recovery discards a link when either side is terminal |
| `CAN-011` | high | sdk-defect | in-progress | `@totemsdk/omnia-host`, `@totemsdk/omnia-splice` | Both live splice paths omit chainProvider, so a broadcast splice is marked active with a placeholder coin |
| `CAN-013` | high | sdk-defect | in-progress | `@totemsdk/omnia-host` | withChannelLock only guards the direct pay path |
| `CAN-014` | high | sdk-defect | in-progress | `@totemsdk/omnia-host` | The watchtower is implemented and exported but never started by the host |
| `CAN-019` | high | sdk-defect | open | `@totemsdk/omnia-host` | Finalization guards validate identifiers, not the resulting state |
| `CAN-020` | high | sdk-defect | in-progress | `@totemsdk/omnia-host` | Factory opening requests the funding signature before the proposal exists (regression from CAN-010) |
| `CAN-023` | high | environment-blocked | in-progress | `hawk-node` | Hawk 0.3.0 cannot complete mainnet IBD: block proofs rejected, blocks skipped, tip parks ~1,000 behind |
| `CAN-025` | high | sdk-defect | fixed | `@totemsdk/liquidity-bond`, `@totemsdk/omnia-host` | Liquidity-bond passes an atom count as the verifier's decimal claimedAmount, rejecting every pool deposit |
| `OMN-002` | high | sdk-defect | open | `@totemsdk/omnia-vtxo` | mintVtxo replaces the pool commitment root with a single-leaf tree |
| `OMN-004` | high | sdk-defect | open | `@totemsdk/omnia-pool`, `@totemsdk/omnia-host` | Pool payout settlement is an unverified caller assertion |
| `OMN-005` | high | sdk-defect | open | `@totemsdk/omnia-pool`, `@totemsdk/liquidity-bond` | recordPoolFee trusts a caller-supplied `verified` flag |
| `OMN-006` | high | sdk-defect | open | `@totemsdk/omnia-relay`, `@totemsdk/omnia-router`, `@totemsdk/omnia-host` | Multi-hop recovery does not journal the outstanding backward preimage duty |
| `OMN-007` | high | sdk-defect | open | `@totemsdk/omnia-vtxo`, `@totemsdk/omnia-host` | VTXO claim verification accepts a caller-supplied signer list |
| `OMN-010` | high | sdk-defect | open | `@totemsdk/omnia-vtxo` | verifyVtxo accepts a VTXO with no membership proof and never anchors the root |
| `OMN-014` → `CAN-012` | high | sdk-defect | open | `@totemsdk/omnia-splice` | Splice recovery can attach one observed successor to several pending splices |
| `OMN-015` → `CAN-021` | high | sdk-defect | open | `@totemsdk/omnia-host` | Watchtower callbacks only emit observations; nothing protects the channel |
| `CAN-005` | medium | sdk-defect | open | `@totemsdk/omnia`, `@totemsdk/omnia-host` | The initiator discards the peer ERROR frame, so a rejected open reports only acknowledged=false |
| `CAN-012` | medium | sdk-defect | in-progress | `@totemsdk/omnia-splice` | Splice successor selection matches on address, token and amount only |
| `CAN-015` | medium | sdk-defect | in-progress | `@totemsdk/omnia-router` | Router rollback cannot release HTLCs early and reports failure as if liquidity were returned |
| `CAN-016` | medium | sdk-defect | in-progress | `@totemsdk/omnia-relay` | Relay link journal is not atomic and duplicate detection races the write |
| `CAN-017` | medium | sdk-defect | in-progress | `@totemsdk/omnia`, `@totemsdk/tx-builder` | Funding change goes to the first input owner, and the builder accepts negative output amounts |
| `CAN-021` | medium | sdk-defect | open | `@totemsdk/omnia-host` | Watchtower starts but only observes; it never contests, fulfils or refunds |
| `CAN-022` | medium | sdk-defect | open | `@totemsdk/omnia-host`, `@totemsdk/omnia-router`, `@totemsdk/omnia-relay` | Prepared operations bypass the channel lock; refunds are not surfaced by the host; journal is not cross-process safe |
| `OMN-009` | medium | sdk-defect | open | `@totemsdk/omnia-vtxo` | EpochAuthority.append is check-then-act across an await |
| `OMN-011` | medium | sdk-gap | open | `@totemsdk/omnia-host`, `@totemsdk/omnia-relay` | Channel graphs advertise every channel that is not closed |
| `OMN-012` | medium | sdk-gap | open | `@totemsdk/omnia-relay`, `@totemsdk/omnia-host` | createMultiHopForwarder is exported but never instantiated by the host |
| `OMN-013` → `CAN-022` | medium | sdk-defect | open | `@totemsdk/omnia-relay` | Link journal serialization is in-process only |
| `OMN-016` → `CAN-022` | medium | sdk-gap | open | `@totemsdk/omnia-host` | Channel locking is keyed by the RPC channelId and multi-channel paths escape it |
| `OMN-017` | medium | sdk-defect | open | `@totemsdk/omnia-factory` | Factory escape block is derived from the local chain tip |
| `sdk-gap:integration-gates` | medium | sdk-gap | open | `@totemsdk/agent-policy`, `@totemsdk/authority`, `@totemsdk/chain-provider`, `@totemsdk/connect`, `@totemsdk/decision`, `@totemsdk/edge`, `@totemsdk/governance`, `@totemsdk/identity`, `@totemsdk/intelligence`, `@totemsdk/kissvm`, `@totemsdk/liquidity-bond`, `@totemsdk/lookup-client`, `@totemsdk/lookup-node`, `@totemsdk/lookup-protocol`, `@totemsdk/manifest`, `@totemsdk/mcp-server`, `@totemsdk/omnia-factory`, `@totemsdk/omnia-host`, `@totemsdk/omnia-pool`, `@totemsdk/omnia-router`, `@totemsdk/omnia-vtxo`, `@totemsdk/p2p-hub`, `@totemsdk/pear`, `@totemsdk/provider-bond`, `@totemsdk/minima-rpc`, `@totemsdk/pubsub-transport`, `@totemsdk/qvac`, `@totemsdk/realtime`, `@totemsdk/recursive-mast`, `@totemsdk/root-identity`, `@totemsdk/se-server`, `@totemsdk/server`, `@totemsdk/storage`, `@totemsdk/stream-transport`, `@totemsdk/tx-builder`, `@totemsdk/txpow`, `@totemsdk/wallet-adapter`, `@totemsdk/wots-lease`, `@totemsdk/entity`, `@totemsdk/eefi`, `@totemsdk/replication` | 41 publishable packages declare no test:integration gate |
| `CAN-003` | low | sdk-defect | fixed | `@totemsdk/omnia-host`, `@totemsdk/lookup-node` | Two unit suites exceed Jest's 5s default timeout under load |
| `OMN-018` | low | sdk-gap | open | `@totemsdk/omnia-host` | Auto-approval has no mandatory bound (hardening, not a defect) |

Per-finding agent briefs are in `agent/`. Each one is self-contained.
