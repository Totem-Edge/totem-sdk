# Canary findings

Generated 2026-11-27T06:45:41.835Z. 152 findings, 14 open.

sdk-defect: 143 · environment-blocked: 1 · sdk-gap: 6 · canary-coverage: 2

| id | severity | kind | status | packages | title |
|---|---|---|---|---|---|
| `CAN-006` | critical | sdk-defect | fixed | `@totemsdk/omnia-host` | A channel is stored as active and submit reports success before the counterparty has acknowledged |
| `CAN-007` | critical | sdk-defect | fixed | `@totemsdk/omnia-host` | Unsolicited SPLICE_FINALIZED and VC_FINALIZED messages overwrite trusted channel state |
| `CAN-010` | critical | sdk-defect | fixed | `@totemsdk/omnia-host` | FACTORY_FUNDING_REQUEST signs an arbitrary peer-supplied digest |
| `CAN-018` | critical | sdk-defect | fixed | `@totemsdk/omnia-host`, `@totemsdk/omnia-factory` | Factory proposal still signs a peer-controlled commitment |
| `CAN-024` | critical | sdk-defect | fixed | `@totemsdk/omnia`, `@totemsdk/omnia-host`, `@totemsdk/chain-provider`, `@totemsdk/core` | Omnia writes atom amounts with MiniNumber scale 0, encoding channel values 10^44 times too large |
| `OMN-001` → `CAN-019` | critical | sdk-defect | fixed | `@totemsdk/omnia-host`, `@totemsdk/omnia-factory` | Peer-scoped finalization stores peer-supplied factory, channel and splice state |
| `OMN-003` | critical | sdk-defect | fixed | `@totemsdk/omnia-vtxo` | A transferred VTXO keeps the previous owner's exit entitlement |
| `OMN-008` | critical | sdk-defect | fixed | `@totemsdk/omnia-vtxo` | Vesting policy never enforces the vested amount before the end block |
| `OMN-022` | critical | sdk-defect | fixed | `@totemsdk/omnia-host`, `@totemsdk/omnia-factory` | The host signs peer-supplied virtual-channel plans without rebuilding them |
| `OMN-023` | critical | sdk-defect | fixed | `@totemsdk/omnia-host`, `@totemsdk/omnia-splice` | Incoming splice proposals are co-signed without verifying the proposer signature or approval |
| `OMN-034` | critical | sdk-defect | fixed | `@totemsdk/omnia-factory`, `@totemsdk/omnia-vtxo`, `@totemsdk/omnia` | Factory and VTXO unilateral escape share ports were serialized at scale zero |
| `OMN-040` | critical | sdk-defect | fixed | `@totemsdk/omnia`, `@totemsdk/omnia-host` | A replayed opening proposal could overwrite an established channel |
| `OMN-051` | critical | sdk-defect | fixed | `@totemsdk/omnia-splice`, `@totemsdk/core` | Splice transactions encoded atom amounts as whole MINIMA |
| `OMN-053` | critical | sdk-defect | fixed | `@totemsdk/omnia-splice` | The splice finalizer constructed a noncanonical witness without spending proofs |
| `OMN-058` | critical | sdk-defect | fixed | `@totemsdk/omnia-factory` | Factory unilateral exits enforce the original funding shares, not the latest signed factory state |
| `OMN-061` | critical | sdk-defect | fixed | `@totemsdk/omnia`, `@totemsdk/omnia-host` | The default co-signer could authorize HTLC fulfilment without a preimage |
| `OMN-066` | critical | sdk-defect | fixed | `@totemsdk/omnia-lsp-provider`, `@totemsdk/omnia-lsp` | An LSP open quote is executed without verifying its signature, terms or policy |
| `OMN-067` | critical | sdk-defect | fixed | `@totemsdk/omnia-lsp-provider` | Admission validates the consumer contribution only, then the host swaps the two sides |
| `OMN-074` → `CAN-012` | critical | sdk-defect | fixed | `@totemsdk/omnia-splice` | A splice successor is identified by address, token and amount only, not by lineage from the splice |
| `OMN-096` | critical | sdk-defect | fixed | `@totemsdk/omnia-host`, `@totemsdk/omnia` | The watchtower treats a stale-state successor as channel continuity |
| `OMN-097` | critical | sdk-defect | fixed | `@totemsdk/omnia`, `@totemsdk/omnia-splice`, `@totemsdk/omnia-host` | No consensus-enforced channel domain: identical parties and delay share a script |
| `OMN-098` | critical | sdk-defect | fixed | `@totemsdk/omnia`, `@totemsdk/omnia-host`, `@totemsdk/omnia-lsp-provider` | A channel is funded before either party holds a unilateral exit package |
| `OMN-106` | critical | sdk-defect | fixed | `@totemsdk/vtxo` | VTXO epoch admission has a check-then-sign race |
| `OMN-108` | critical | sdk-defect | fixed | `@totemsdk/omnia`, `@totemsdk/omnia-host` | Signing admission reads an unreadable journal as "no history" |
| `OMN-110` | critical | sdk-defect | fixed | `@totemsdk/liquidity-bond`, `@totemsdk/omnia-pool` | A liquidity position can become active without funding evidence |
| `OMN-111` | critical | sdk-defect | fixed | `@totemsdk/omnia-pool`, `@totemsdk/liquidity-bond` | One accepted commitment can create multiple liquidity positions |
| `CAN-001` | high | sdk-defect | fixed | `@totemsdk/omnia`, `@totemsdk/omnia-host`, `@totemsdk/tx-builder` | Channel funding draft silently drops the unspent part of the funding coin |
| `CAN-002` | high | sdk-defect | fixed | `@totemsdk/proof`, `@totemsdk/manifest` | Manifest proofs are not bound to the manifest they attest |
| `CAN-004` | high | sdk-defect | fixed | `@totemsdk/omnia`, `@totemsdk/omnia-host` | Non-custodial channel open races the chain: the acceptor validates the funding coin before it can be mined |
| `CAN-008` | high | sdk-defect | fixed | `@totemsdk/omnia-relay` | Forwarder signs the outgoing HTLC before the link is durable |
| `CAN-009` | high | sdk-defect | fixed | `@totemsdk/omnia-relay` | Relay recovery discards a link when either side is terminal |
| `CAN-011` | high | sdk-defect | fixed | `@totemsdk/omnia-host`, `@totemsdk/omnia-splice` | Both live splice paths omit chainProvider, so a broadcast splice is marked active with a placeholder coin |
| `CAN-013` | high | sdk-defect | fixed | `@totemsdk/omnia-host` | withChannelLock only guards the direct pay path |
| `CAN-014` | high | sdk-defect | fixed | `@totemsdk/omnia-host` | The watchtower is implemented and exported but never started by the host |
| `CAN-019` | high | sdk-defect | fixed | `@totemsdk/omnia-host` | Finalization guards validate identifiers, not the resulting state |
| `CAN-020` | high | sdk-defect | fixed | `@totemsdk/omnia-host` | Factory opening requests the funding signature before the proposal exists (regression from CAN-010) |
| `CAN-023` | high | environment-blocked | in-progress | `hawk-node` | Hawk 0.3.0 cannot complete mainnet IBD: block proofs rejected, blocks skipped, tip parks ~1,000 behind |
| `CAN-025` | high | sdk-defect | fixed | `@totemsdk/liquidity-bond`, `@totemsdk/omnia-host` | Liquidity-bond passes an atom count as the verifier's decimal claimedAmount, rejecting every pool deposit |
| `OMN-002` | high | sdk-defect | fixed | `@totemsdk/omnia-vtxo` | mintVtxo replaces the pool commitment root with a single-leaf tree |
| `OMN-004` | high | sdk-defect | fixed | `@totemsdk/omnia-pool`, `@totemsdk/omnia-host` | Pool payout settlement is an unverified caller assertion |
| `OMN-005` | high | sdk-defect | fixed | `@totemsdk/omnia-pool`, `@totemsdk/liquidity-bond` | recordPoolFee trusts a caller-supplied `verified` flag |
| `OMN-006` | high | sdk-defect | fixed | `@totemsdk/omnia-relay`, `@totemsdk/omnia-router`, `@totemsdk/omnia-host` | Multi-hop recovery does not journal the outstanding backward preimage duty |
| `OMN-007` | high | sdk-defect | fixed | `@totemsdk/omnia-vtxo`, `@totemsdk/omnia-host` | VTXO claim verification accepts a caller-supplied signer list |
| `OMN-010` | high | sdk-defect | fixed | `@totemsdk/omnia-vtxo` | verifyVtxo accepts a VTXO with no membership proof and never anchors the root |
| `OMN-014` → `CAN-012` | high | sdk-defect | fixed | `@totemsdk/omnia-splice` | Splice recovery can attach one observed successor to several pending splices |
| `OMN-015` → `CAN-021` | high | sdk-defect | fixed | `@totemsdk/omnia-host` | Watchtower callbacks only emit observations; nothing protects the channel |
| `OMN-024` | high | sdk-defect | fixed | `@totemsdk/omnia-host`, `@totemsdk/omnia` | Payments report success before the counterparty co-signs |
| `OMN-025` | high | sdk-defect | fixed | `@totemsdk/omnia-vtxo` | Exit entitlements still do not prove the witness or the authoritative pool coin |
| `OMN-026` | high | sdk-defect | fixed | `@totemsdk/omnia-host` | An incoming message can overwrite the cached peer for an unrelated channel |
| `OMN-027` | high | sdk-defect | fixed | `@totemsdk/omnia-host` | The advertised N-party factory API coordinates with only one remote participant |
| `OMN-030` | high | sdk-defect | fixed | `@totemsdk/omnia-host`, `@totemsdk/omnia-pool`, `@totemsdk/liquidity-bond` | Liquidity deposits can be credited against a coin that does not belong to the claimed LP |
| `OMN-031` | high | sdk-defect | fixed | `@totemsdk/omnia-host`, `@totemsdk/omnia-factory` | The release gate can ignore an unresolved critical finding through an alias |
| `OMN-032` | high | sdk-defect | fixed | `@totemsdk/omnia-host`, `@totemsdk/omnia-pool` | Pool accounting can diverge between liquidity positions |
| `OMN-033` | high | sdk-defect | fixed | `@totemsdk/omnia-pool`, `@totemsdk/liquidity-bond` | One unspent funding coin can support multiple LP commitments |
| `OMN-035` | high | sdk-defect | fixed | `@totemsdk/omnia-vtxo`, `@totemsdk/chain-provider` | VTXO epochs are marked published after broadcast, not chain confirmation |
| `OMN-036` | high | sdk-defect | fixed | `@totemsdk/omnia-host`, `@totemsdk/tx-builder` | Automatic channel funding selection compares atoms with decimal MINIMA |
| `OMN-037` | high | sdk-defect | fixed | `@totemsdk/omnia-host`, `@totemsdk/omnia-factory` | Factory RPCs interpret contributions as atoms instead of decimal amounts |
| `OMN-038` | high | sdk-defect | fixed | `@totemsdk/omnia` | Inbound HTLC validation compared the proposed state with itself |
| `OMN-039` | high | sdk-defect | fixed | `@totemsdk/omnia`, `@totemsdk/omnia-host` | Crash recovery could lose the signing watermark after a WOTS signature was released |
| `OMN-041` | high | sdk-defect | fixed | `@totemsdk/omnia-host`, `@totemsdk/omnia-vtxo` | The host could issue active VTXOs without verified on-chain backing |
| `OMN-042` | high | sdk-defect | fixed | `@totemsdk/omnia-host`, `@totemsdk/omnia-vtxo` | VTXO exits could be marked complete without proving a payout |
| `OMN-045` | high | sdk-defect | fixed | `@totemsdk/omnia-host`, `@totemsdk/omnia-vtxo` | Recreating a VTXO pool with the same identity reset its capacity and commitment history |
| `OMN-046` | high | sdk-defect | fixed | `@totemsdk/omnia-vtxo`, `@totemsdk/omnia-host` | VTXO refresh could overwrite its own input because the id excluded the epoch |
| `OMN-047` | high | sdk-defect | fixed | `@totemsdk/omnia-vtxo`, `@totemsdk/omnia-host` | Operator receipt signing broke after the first mint into a VTXO pool |
| `OMN-048` | high | sdk-defect | fixed | `@totemsdk/omnia`, `@totemsdk/omnia-host` | Duplicate incoming state updates could consume multiple WOTS key pairs at the same sequence |
| `OMN-049` | high | sdk-defect | fixed | `@totemsdk/omnia`, `@totemsdk/omnia-host` | Prepared-signature submissions did not prevent one-time WOTS key reuse |
| `OMN-050` | high | sdk-defect | fixed | `@totemsdk/omnia-host`, `@totemsdk/omnia-pool` | Recreating a liquidity pool could erase its authoritative registry |
| `OMN-052` | high | sdk-defect | fixed | `@totemsdk/omnia-splice`, `@totemsdk/omnia-host` | Splice-in proposals omitted the additional coin address |
| `OMN-054` | high | sdk-defect | fixed | `@totemsdk/omnia-host`, `@totemsdk/omnia-pool`, `@totemsdk/chain-provider` | Liquidity deposits could be marked chain-confirmed without requiring confirmation |
| `OMN-055` | high | sdk-defect | fixed | `@totemsdk/omnia-vtxo`, `@totemsdk/omnia-host` | VTXO transfers and refreshes produced active claims absent from the pool commitment |
| `OMN-059` | high | sdk-defect | fixed | `@totemsdk/omnia-vtxo` | A unilateral VTXO exit could alter the remaining pool root and epoch |
| `OMN-062` | high | sdk-defect | fixed | `@totemsdk/omnia-vtxo` | VTXO on-chain spending helpers broadcast without required proofs |
| `OMN-063` | high | sdk-defect | fixed | `@totemsdk/omnia`, `@totemsdk/omnia-factory`, `@totemsdk/omnia-host` | Funding activation did not consistently wait for chain confirmations |
| `OMN-064` | high | sdk-defect | fixed | `@totemsdk/kissvm` | KISSVM CHECKSIG ignores its documented data and signature arguments |
| `OMN-068` | high | sdk-defect | fixed | `@totemsdk/omnia-lsp-provider` | LSP quotes are issued against advertised capacity with no durable reservation |
| `OMN-069` | high | sdk-defect | fixed | `@totemsdk/omnia-lsp-provider` | Manifest freshness is decided with a caller-supplied clock |
| `OMN-070` | high | sdk-defect | fixed | `@totemsdk/omnia-lsp-provider` | Host adapter reports success for an undefined, malformed or error-only response |
| `OMN-071` | high | sdk-defect | fixed | `@totemsdk/omnia-lsp` | Quote validation establishes shape, not authenticity |
| `OMN-072` | high | sdk-defect | fixed | `@totemsdk/omnia-lsp-provider`, `@totemsdk/omnia-lsp` | LSP fee admission and fee calculation ignore the flat fee and the provider's contribution |
| `OMN-075` | high | sdk-defect | fixed | `@totemsdk/omnia-splice` | The pending splice journal does not record its expected successor |
| `OMN-076` | high | sdk-defect | fixed | `@totemsdk/omnia-splice`, `@totemsdk/omnia-host` | The splice journal is cleared before the successor channel is persisted |
| `OMN-077` | high | sdk-defect | fixed | `@totemsdk/omnia-host` | Operation replay verification loses its receiver and throws instead of returning the committed result |
| `OMN-078` | high | sdk-defect | fixed | `@totemsdk/omnia-host` | An observability failure can strand a committed operation or misreport it as failed |
| `OMN-079` | high | sdk-defect | fixed | `@totemsdk/omnia-host` | An operation whose financial side effect is unknown is classified as a retryable failure |
| `OMN-080` | high | sdk-defect | fixed | `@totemsdk/omnia-router` | Route validation checks each hop and never the path |
| `OMN-081` | high | sdk-defect | fixed | `@totemsdk/omnia-router` | Consecutive HTLC deadlines differ by one block in multi-hop and cross-token execution |
| `OMN-082` → `CAN-015` | high | sdk-defect | fixed | `@totemsdk/omnia-router` | Rollback silently drops a locked HTLC when its channel or lease provider is missing |
| `OMN-083` | high | sdk-defect | fixed | `@totemsdk/omnia-router`, `@totemsdk/omnia-pool` | Router fee proofs hash descriptive fields and are not settlement evidence |
| `OMN-084` → `CAN-016` | high | sdk-defect | fixed | `@totemsdk/omnia-relay` | Forwarding admission is a check-then-write across awaits, not an atomic reservation |
| `OMN-085` | high | sdk-defect | fixed | `@totemsdk/omnia-relay` | Forwarding compares amounts across assets without an exchange-rate authorization |
| `OMN-086` | high | sdk-defect | fixed | `@totemsdk/omnia-relay` | An outgoing forward is journaled as active before the peer has received or acknowledged it |
| `OMN-087` | high | sdk-defect | fixed | `@totemsdk/omnia-vtxo` | Exit entitlement verification checks that a pool epoch exists, not that it publishes this root |
| `OMN-088` | high | sdk-defect | fixed | `@totemsdk/omnia-vtxo` | createExitDraft returns a receipt without consuming it |
| `OMN-089` | high | sdk-defect | fixed | `@totemsdk/omnia-vtxo`, `@totemsdk/omnia-host` | markExited accepts any non-empty transaction id as proof of exit |
| `OMN-090` | high | sdk-defect | fixed | `@totemsdk/omnia-pool` | Pool payout trusts caller-supplied position and intent instead of the registry |
| `OMN-091` | high | sdk-defect | fixed | `@totemsdk/omnia-pool` | A partial withdrawal resets the remaining liquidity to fully available and unimpaired |
| `OMN-092` | high | sdk-defect | fixed | `@totemsdk/omnia-pool` | Liquidity receipt consumption is skipped when the receipt is missing |
| `OMN-093` | high | sdk-defect | fixed | `@totemsdk/omnia` | Fulfilment and timeout are both eligible at the exact timeout block |
| `OMN-094` | high | sdk-defect | fixed | `@totemsdk/omnia`, `@totemsdk/omnia-pool` | HTLC fulfilment receipts are not bound to the authenticated transition that paid them |
| `OMN-095` | high | sdk-gap | fixed | `@totemsdk/omnia-factory` | A factory participant's latest off-chain allocation is not unilaterally enforceable |
| `OMN-099` | high | sdk-defect | fixed | `@totemsdk/omnia-host` | Channel activation conflates funding depth with peer acceptance |
| `OMN-100` | high | sdk-defect | fixed | `@totemsdk/omnia` | Unilateral update coin verification does not bind sequence, commitment, amount or lineage |
| `OMN-101` | high | sdk-defect | fixed | `@totemsdk/omnia` | A unilateral settlement broadcast is recorded as a completed closure |
| `OMN-102` | high | sdk-defect | fixed | `@totemsdk/omnia-host`, `@totemsdk/omnia-router` | The distributed multi-hop branch bypasses the durable operation lifecycle |
| `OMN-103` | high | sdk-defect | fixed | `@totemsdk/omnia-host`, `@totemsdk/omnia-router` | Cross-token locality is decided from the inbound channel only |
| `OMN-104` | high | sdk-defect | fixed | `null` | The S4 harness can report S4_PASS without asserting settlement |
| `OMN-105` | high | sdk-defect | fixed | `@totemsdk/omnia-host` | Automated watcher actions bypass the channel mutation coordinator |
| `OMN-107` | high | sdk-defect | fixed | `@totemsdk/vtxo` | Epoch recovery reconstructs history without authenticating it |
| `OMN-109` | high | sdk-defect | fixed | `@totemsdk/omnia` | An interrupted signer response can release the signing guard |
| `OMN-112` | high | sdk-defect | fixed | `@totemsdk/liquidity-bond`, `@totemsdk/omnia-pool` | Allocation verification ignores reserved and risk-adjusted capital |
| `OMN-113` | high | sdk-defect | fixed | `@totemsdk/omnia-pool` | The recorded allocation amount is not bound to the executed operation |
| `OMN-114` | high | sdk-defect | fixed | `@totemsdk/omnia-pool` | An allocation can be released without proof of capital recovery |
| `OMN-115` | high | sdk-defect | fixed | `@totemsdk/omnia-factory` | Factory persistence permits a stale record to overwrite a newer one |
| `OMN-116` | high | sdk-defect | fixed | `@totemsdk/omnia-splice` | Splice acceptance can regress a finalized record |
| `OMN-117` | high | sdk-defect | fixed | `@totemsdk/vtxo` | VTXO split outputs can receive duplicate identifiers |
| `OMN-118` | high | sdk-defect | fixed | `@totemsdk/vtxo` | VTXO conservation verification accepts duplicate and negative records |
| `OMN-119` | high | sdk-defect | fixed | `@totemsdk/omnia-router` | A malformed routing envelope is interpreted as a final destination |
| `OMN-120` | high | sdk-defect | fixed | `@totemsdk/omnia-relay` | Routing advertisements include channels that are not active |
| `OMN-121` | high | sdk-defect | fixed | `@totemsdk/omnia-host`, `@totemsdk/omnia` | The signing policy is skipped when a request carries no amount |
| `OMN-122` | high | sdk-defect | fixed | `@totemsdk/wots-lease` | The Axia lease adapter does not defensively validate remote indices |
| `OMN-123` | high | sdk-defect | fixed | `@totemsdk/storage` | Journal recovery can race an in-progress append |
| `OMN-124` | high | sdk-defect | fixed | `@totemsdk/chain-provider`, `@totemsdk/omnia` | Confirmation depth is computed differently across packages |
| `OMN-125` | high | sdk-defect | fixed | `@totemsdk/omnia-pool`, `@totemsdk/liquidity-bond` | Fee earn-proofs can be appended more than once |
| `OMN-126` | high | sdk-defect | fixed | `@totemsdk/txpow` | The TxPoW work verifier fails open when parsing fails |
| `OMN-127` | high | sdk-defect | fixed | `@totemsdk/omnia-factory` | Virtual-channel planning accepts the same participant twice |
| `CAN-005` | medium | sdk-defect | open | `@totemsdk/omnia`, `@totemsdk/omnia-host` | The initiator discards the peer ERROR frame, so a rejected open reports only acknowledged=false |
| `CAN-012` | medium | sdk-defect | fixed | `@totemsdk/omnia-splice` | Splice successor selection matches on address, token and amount only |
| `CAN-015` | medium | sdk-defect | fixed | `@totemsdk/omnia-router` | Router rollback cannot release HTLCs early and reports failure as if liquidity were returned |
| `CAN-016` | medium | sdk-defect | fixed | `@totemsdk/omnia-relay` | Relay link journal is not atomic and duplicate detection races the write |
| `CAN-017` | medium | sdk-defect | in-progress | `@totemsdk/omnia`, `@totemsdk/tx-builder` | Funding change goes to the first input owner, and the builder accepts negative output amounts |
| `CAN-021` | medium | sdk-defect | open | `@totemsdk/omnia-host` | Watchtower starts but only observes; it never contests, fulfils or refunds |
| `CAN-022` | medium | sdk-defect | open | `@totemsdk/omnia-host`, `@totemsdk/omnia-router`, `@totemsdk/omnia-relay` | Prepared operations bypass the channel lock; refunds are not surfaced by the host; journal is not cross-process safe |
| `CAN-026` | medium | canary-coverage | open | `@totemsdk/omnia-lsp`, `@totemsdk/omnia-lsp-provider` | No scenario exercises omnia-lsp or omnia-lsp-provider |
| `CAN-027` | medium | canary-coverage | open | `@totemsdk/omnia-vtxo` | omnia-vtxo has no dedicated lifecycle scenario |
| `OMN-009` | medium | sdk-defect | open | `@totemsdk/omnia-vtxo` | EpochAuthority.append is check-then-act across an await |
| `OMN-011` | medium | sdk-gap | open | `@totemsdk/omnia-host`, `@totemsdk/omnia-relay` | Channel graphs advertise every channel that is not closed |
| `OMN-012` | medium | sdk-gap | open | `@totemsdk/omnia-relay`, `@totemsdk/omnia-host` | createMultiHopForwarder is exported but never instantiated by the host |
| `OMN-013` → `CAN-022` | medium | sdk-defect | open | `@totemsdk/omnia-relay` | Link journal serialization is in-process only |
| `OMN-016` → `CAN-022` | medium | sdk-gap | open | `@totemsdk/omnia-host` | Channel locking is keyed by the RPC channelId and multi-channel paths escape it |
| `OMN-017` | medium | sdk-defect | open | `@totemsdk/omnia-factory` | Factory escape block is derived from the local chain tip |
| `OMN-028` | medium | sdk-defect | fixed | `@totemsdk/omnia` | Repeated settlement requests can exhaust WOTS signing capacity |
| `OMN-029` | medium | sdk-defect | fixed | `@totemsdk/omnia-vtxo` | VTXO transfer verification omits value and recipient binding |
| `OMN-043` | medium | sdk-defect | fixed | `@totemsdk/omnia-host`, `@totemsdk/omnia-pool` | Live liquidity allocation targets were exposed but not wired to execution |
| `OMN-044` | medium | sdk-defect | fixed | `@totemsdk/omnia-host`, `@totemsdk/omnia-router` | Unauthenticated route advertisements could poison the routing graph |
| `OMN-056` | medium | sdk-defect | fixed | `@totemsdk/omnia-host`, `@totemsdk/omnia-splice` | Explicit splice balance maps were not converted at the RPC boundary |
| `OMN-057` | medium | sdk-defect | open | `@totemsdk/omnia`, `@totemsdk/omnia-host`, `@totemsdk/wots-lease` | Channel capacity warnings ignore the host shared physical WOTS tree |
| `OMN-060` | medium | sdk-defect | fixed | `@totemsdk/omnia-factory` | Factory funding omitted the participant-root commitment its script pins |
| `OMN-065` | medium | sdk-defect | fixed | `@totemsdk/kissvm`, `@totemsdk/core-wasm` | Rust/WASM CHECKSIG cannot verify a tree signature (the on-chain form) |
| `OMN-073` | medium | sdk-defect | fixed | `@totemsdk/omnia-lsp-provider`, `@totemsdk/omnia-lsp` | Decimal parsing in the LSP truncates precision and mis-signs negative input |
| `sdk-gap:integration-gates` | medium | sdk-gap | open | `@totemsdk/agent-policy`, `@totemsdk/authority`, `@totemsdk/chain-provider`, `@totemsdk/connect`, `@totemsdk/decision`, `@totemsdk/edge`, `@totemsdk/governance`, `@totemsdk/identity`, `@totemsdk/intelligence`, `@totemsdk/kissvm`, `@totemsdk/liquidity-bond`, `@totemsdk/lookup-client`, `@totemsdk/lookup-node`, `@totemsdk/lookup-protocol`, `@totemsdk/manifest`, `@totemsdk/mcp-server`, `@totemsdk/omnia-factory`, `@totemsdk/omnia-host`, `@totemsdk/omnia-lsp`, `@totemsdk/omnia-lsp-provider`, `@totemsdk/omnia-pool`, `@totemsdk/omnia-router`, `@totemsdk/p2p-hub`, `@totemsdk/pear`, `@totemsdk/provider-bond`, `@totemsdk/minima-rpc`, `@totemsdk/pubsub-transport`, `@totemsdk/qvac`, `@totemsdk/realtime`, `@totemsdk/recursive-mast`, `@totemsdk/root-identity`, `@totemsdk/se-server`, `@totemsdk/server`, `@totemsdk/storage`, `@totemsdk/stream-transport`, `@totemsdk/tx-builder`, `@totemsdk/txpow`, `@totemsdk/wallet-adapter`, `@totemsdk/wots-lease`, `@totemsdk/entity`, `@totemsdk/eefi`, `@totemsdk/replication`, `@totemsdk/vtxo`, `@totemsdk/claim` | 44 publishable packages declare no test:integration gate |
| `CAN-003` | low | sdk-defect | fixed | `@totemsdk/omnia-host`, `@totemsdk/lookup-node` | Two unit suites exceed Jest's 5s default timeout under load |
| `OMN-018` | low | sdk-gap | open | `@totemsdk/omnia-host` | Auto-approval has no mandatory bound (hardening, not a defect) |

Per-finding agent briefs are in `agent/`. Each one is self-contained.
