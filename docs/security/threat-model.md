# Totem SDK Public Threat Model

**Status:** Published — Phase 1 B1; external review pending
**Owner:** Totem SDK maintainers
**Last reviewed:** 2026-10-25
**Related:** [SECURITY.md](../../SECURITY.md), [crypto-policy.md](crypto-policy.md),
[RFC-063](../rfc/RFC-063-PRODUCTION-READINESS-AND-MATURITY-PROMOTION.md)

---

## 1. Scope

This model covers the SDK surfaces that carry a production or production-candidate
claim:

- **Tier 0:** `core`, `core-wasm`, `kissvm`
- **Tier 1:** `wots-lease`, `omnia`, `omnia-host`, `storage`, `lookup-protocol`,
  `lookup-client`, `lookup-node`, `industrial-action`, `edge-mqtt`, `edge-modbus`
- **Tier 2 on the supported path:** the transaction, identity, transport and
  Omnia composition packages listed in RFC-063 §4.4, plus `edge`
- **Cross-cutting:** build, release, distribution and operator configuration

It also covers the wallet-facing `connect` and wallet-runtime surfaces where they
are the enforcement point for approvals, origin checks or signing.

Out of scope:

- Tier 3/outside packages, experimental RFCs and economic primitives not on the
  supported path
- hosted service operations owned by a third party
- mainnet value-bearing deployments
- independent audit conclusions (not yet performed)
- physical security of operators and hardware

Current evidence limits are part of the model: the SDK is pre-1.0, Tier 1
packages remain RC/alpha, there is no current independent audit, HIL evidence is
incomplete, and RFC-057 replication is Phase 0. Nothing here is a mainnet
readiness or production-support claim beyond the narrow Tier 0 core.

---

## 2. Security objectives

1. **No WOTS leaf reuse.** A one-time key index must never sign two different
   messages. This is the highest-severity invariant.
2. **Key confinement.** Seeds, private keys and unspent signing capability do not
   leave the custody boundary that is supposed to hold them.
3. **Consensus fidelity.** Serialization, hashing, scripts and signatures remain
   byte-exact with the supported Minima node behavior.
4. **Channel safety.** A channel update, HTLC, settlement, factory or virtual
   channel cannot create value, double-spend, or strand funds without an
   explicit timeout/exit path.
5. **Replay and rollback resistance.** Signed messages, sequence numbers, tickets,
   nonces and operation IDs cannot be replayed or rewound to restore spent
   capability.
6. **Approval and authority boundaries.** A dApp, agent or remote peer cannot
   turn a read, proposal or low-authority action into a signing or value-moving
   action outside the user/policy decision.
7. **Durable recovery.** A restart, crash or stale backup cannot silently lose
   committed state or resurrect revoked/spent state.
8. **Evidence integrity.** Release and test evidence is tied to a pinned commit,
   exact artifacts and reproducible commands.

Liveness, privacy and censorship resistance are objectives, but the current
evidence is weaker than for safety. The model does not promise strong anonymity,
global availability or economic security.

---

## 3. Assets

| Asset | Why it matters | Primary owner |
|---|---|---|
| Seed / root identity | Derives all keys and identities | Wallet / signer |
| WOTS/TreeKey one-time leaves | Reuse enables key recovery | `wots-lease`, wallet |
| Signing reservations and watermark | Prevent leaf reuse | `wots-lease`, storage |
| Channel state and balances | Value and settlement correctness | `omnia`, `omnia-host` |
| HTLC preimages and hash locks | Payment completion and theft resistance | `omnia`, `omnia-host` |
| Factory/VC/VTXO/pool state | Teardown, exit and allocation correctness | `omnia-*`, `storage` |
| Operation journal | Idempotency and crash recovery | `omnia-host`, `storage` |
| Session tickets | Authentication without per-message WOTS | `lookup-node` |
| Manifests and identity bindings | Author/operator authenticity | `manifest`, `identity` |
| Policy, authority and receipts | Governed action and auditability | `agent-policy`, `authority`, `industrial-action`, `edge` |
| Node RPC credentials | Chain read/broadcast authority | Node operator |
| Build/release artifacts | Supply-chain trust | Maintainers/CI |

---

## 4. Actors and attacker classes

| Actor | Capability |
|---|---|
| User / wallet owner | Holds seed, approves actions, may be phished or make mistakes |
| dApp / page | Untrusted JavaScript, can request actions and spoof UI context |
| Wallet/extension | Enforcement point for origin, approval and key confinement; can be compromised |
| Remote peer | Can send arbitrary proposals, updates, malformed frames and replay traffic |
| Coordinator/host operator | Runs channel/factory state; may be malicious, compromised or misconfigured |
| Wallet-service signer | Holds signing authority for a coordinator; can be compromised or unavailable |
| Chain/RPC provider | Can lie, omit, delay or replay chain data if not verified |
| Relay/DHT participant | Can observe metadata, drop traffic, eclipse or Sybil |
| Supply-chain attacker | Can compromise dependencies, CI, npm artifacts or build scripts |
| Local malware | Can read process memory, files, browser storage or inject into the wallet |
| Insider / operator error | Can misconfigure, leak credentials or restore a stale backup |
| Canary/test operator | Produces evidence; an invalid run is an evidence-integrity threat |

---

## 5. Trust boundaries

| ID | Boundary | Trusted side | Untrusted / lower-trust side |
|---|---|---|---|
| TB1 | dApp ↔ wallet `connect` | Wallet approval and signer ports | Page origin, request params, display context |
| TB2 | Wallet ↔ node RPC | Local wallet state | Remote HTTP/RPC endpoint and its responses |
| TB3 | Host ↔ host | Local host state and signer | Peer messages, relay/DHT transport |
| TB4 | Host ↔ wallet service | Wallet-service signer | Coordinator host, RPC caller |
| TB5 | Host ↔ chain | Verified chain data / local node | Remote node, mempool, reorg |
| TB6 | Process ↔ storage | Process memory | SQLite/file/IndexedDB media, backups |
| TB7 | Agent/operator ↔ policy | Policy/authority decision | Agent proposal, remote command |
| TB8 | Source/build ↔ artifact | Reviewed source and CI | Dependencies, caches, npm/GitHub artifacts |
| TB9 | Extension ↔ page | Service worker and vault | Page content script, injected scripts |

The boundaries are not all equally strong. A local loopback host is not the same
trust level as a public RPC endpoint. A wallet service is not automatically
trusted just because it is on the same machine.

---

## 6. Assumptions

- CSPRNG output is unpredictable and the platform's crypto implementation is not
  backdoored.
- The user's seed and unlocked key material remain secret from the attacker
  unless the wallet/host is compromised.
- Remote RPC endpoints use TLS and authentication when they are not loopback.
- A single WOTS leaf is used at most once; the lease/watermark path is the
  enforcement mechanism.
- Chain data used for value decisions is verified where the protocol claims
  verification, not merely fetched.
- Expiry windows assume clocks are roughly synchronized; the protocol must not
  rely on clocks alone for safety.
- No claim is made against an attacker who controls the user's device, browser,
  wallet extension, signing service and backups simultaneously.
- Testnet evidence is not treated as mainnet evidence.

---

## 7. Threat catalogue

Severity is the potential impact if the threat is realized without a control.
“Residual” records what remains after current controls and evidence.

### 7.1 Key custody and signing

| ID | Threat | Impact | Affected | Current controls | Residual |
|---|---|---|---|---|---|
| T1 | WOTS leaf reuse through crash, restore, concurrency or operator error | Critical — key recovery/forgery | `wots-lease`, `storage`, wallet, host | Lease reservation, monotonic watermark, durable journal, CAS storage, fail-closed errors, signer audit | Real-node restart/restored-backup evidence still pending; recovery runbooks not yet tested (B4) |
| T2 | Seed/private-key exfiltration from memory, disk or logs | Critical — full wallet compromise | Wallet, extension, signer, storage | Key confinement, encrypted seed storage policy, no plaintext seed in host, zeroing guidance, non-custodial host boundary | Local malware/compromised browser is not defeated; extension storage and backup handling need audit |
| T3 | Signing-service compromise or unauthorized signing | Critical — value loss / key reuse | Wallet service, host | Separate signer, approvals, authority/policy, MFA/TOTP and durable signer audit where enabled | Operator can still misconfigure; no independent audit; compromise detection is limited |
| T4 | Signature verification accepts a different signer than the claimed author/operator | High — impersonation | `manifest`, `identity` | Signer address derived from public key and bound to wrapper/manifest; advisory fixed in manifest 2.0.2 | Other manifest/identity paths need continuing review |

### 7.2 Wallet/dApp boundary

| ID | Threat | Impact | Affected | Current controls | Residual |
|---|---|---|---|---|---|
| T5 | Malicious dApp uses a trusted origin or misleading UI to obtain approval | High — unauthorized spend/sign | `connect`, wallet UI | Origin checks, approval callbacks, typed requests, capability manifest, 50-method inventory | UI/display binding is a wallet responsibility; phishing and approval fatigue remain |
| T6 | Method advertised as supported but fails or is silently unimplemented | Medium — user confusion / unsafe fallback | `connect`, wallet runtime | Capability manifest, `supports()` probes, parity tests, `UNSUPPORTED` disposition | Some outside/advanced methods remain client-dependent |
| T7 | dApp injects parameters that change the meaning of a transaction | High — wrong recipient/amount/script | `connect`, tx builder | Typed params, canonical method contract, approval payload | Wallets must display the decoded intent, not just the method name |

### 7.3 Network, peer and channel boundaries

| ID | Threat | Impact | Affected | Current controls | Residual |
|---|---|---|---|---|---|
| T8 | Malicious peer sends malformed/replayed channel, factory or VC messages | High — state corruption or loss | `omnia`, `omnia-host` | Message framing, peer binding, proposal validation, sequence/nonce checks, timeout paths | Fuzz/property coverage incomplete (B3); Canary adversarial routing evidence pending |
| T9 | Restart loses factory/VC/VTXO/pool state and teardown becomes impossible | High — stranded funds | `omnia-host`, `storage` | Durable SQLite stores, persistent maps, operation journal | Real 7-hop teardown/reopen gate still pending; crash-window evidence pending |
| T10 | HTLC preimage leaks or is replayed before settlement | High — payment theft/loss | `omnia`, `omnia-host` | Hashlock binding, backward fulfillment, timeout/refund, operation IDs | Economic/routing adversary evidence pending; no independent audit |
| T11 | Routing/liquidity adversary griefs, loops or drains fees | Medium/High — liveness/value loss | `omnia`, `omnia-router`, `omnia-relay` | Route validation, fee accounting, hop limits, relay rejection of unsupported cross-token hops | No adversarial economic model or long-running liquidity evidence yet |
| T12 | Relay/DHT observer maps participants or partitions the network | Medium — privacy/liveness | `omnia-relay`, `omnia`, `p2p-hub` | Hyperswarm/relay encryption, topic separation, self-hosted relay option | Traffic analysis and eclipse resistance are not proven; privacy is limited |
| T13 | Chain/RPC provider lies about tip, coin, proof or confirmation | High — wrong settlement decision | `chain-provider`, `minima-rpc`, `omnia-host` | Confirmation checks, proofs where claimed, strict HTTP client, local node option | Trust model depends on verification path; not every caller verifies proofs |

### 7.4 Lookup and authentication

| ID | Threat | Impact | Affected | Current controls | Residual |
|---|---|---|---|---|---|
| T14 | Session ticket theft/replay or use after revocation | High — impersonation | `lookup-node`, `lookup-client` | Node-signed tickets, subject binding, per-ticket `seq`, expiry, budget, revocation, durable ticket store, node-id binding | Multi-peer/teardown/leak evidence pending; ticket binding to transport peer is not universal |
| T15 | Replay of a WOTS auth envelope or non-monotonic nonce | High — unauthorized request | `lookup-*` | Per-identity nonce monotonicity, replay guard, node watermark persistence | Long-running multi-peer and clock-skew evidence pending |
| T16 | Sybil/poisoned registry data misleads lookup consumers | Medium/High — bad discovery | `lookup-node` | Signed manifests, WOTS auth, registry validation, revocation | Reputation/trust is local and bounded; no global truth claim |

### 7.5 Storage and recovery

| ID | Threat | Impact | Affected | Current controls | Residual |
|---|---|---|---|---|---|
| T17 | Lost update / CAS race corrupts lease, ticket or channel state | High — key reuse or value loss | `storage` | CAS serialization, file-store lock recovery, SQLite WAL, reopen tests | Crash/power-loss/corruption evidence across backends still being gathered |
| T18 | Corrupt or malicious DB is accepted as valid state | High — unsafe recovery | `storage`, host, lookup | Fail-closed errors, format checks, schema/namespace checks | No formal corruption recovery evidence for every backend |
| T19 | Stale backup restores an old watermark or spent ticket | High — leaf reuse or replay | `wots-lease`, `lookup-node`, `omnia-host` | Monotonic watermark, persisted ticket seq, restore-forward checks | Restored-backup test is a Phase 1/B4 deliverable |
| T20 | Two processes share state without coordination | High — double spend/reuse | `storage`, host, lease | CAS, locks, SQLite transactions | Cross-process contention evidence is still limited |

### 7.6 Policy, industrial and physical effects

| ID | Threat | Impact | Affected | Current controls | Residual |
|---|---|---|---|---|---|
| T21 | Agent bypasses policy/approval and executes a consequential action | High — unauthorized spend/physical effect | `edge`, `agent-policy`, `industrial-action` | Governed edge runtime, approval/reservation, authority binding, two-phase execution | Post-authorization negotiation residual; no independent audit |
| T22 | Prepared command is altered between approval and execution | High — different effect than approved | `edge`, `industrial-action` | Prepared-command binding, idempotency, receipts, decision refs | RFC-021/022/023 still draft; enforcement completeness not proven |
| T23 | Interlock/safe-state bypass or stale physical state | Critical in HIL contexts | `industrial-action`, `edge-modbus`, `edge-mqtt` | Interlocks, safe-state, authority policies, failure semantics | HIL evidence incomplete; no physical deployment claim |
| T24 | Reconnect/duplicate delivery causes repeated physical action | High | `edge-mqtt`, `industrial-action` | Idempotency, durable at-most-once storage, replay protections | Broker/PLC HIL and power-loss evidence pending |

### 7.7 Release, supply chain and evidence

| ID | Threat | Impact | Affected | Current controls | Residual |
|---|---|---|---|---|---|
| T25 | Compromised dependency, CI runner or npm artifact | Critical — arbitrary code/key theft | All | Lockfile, dependency review policy, CI, provenance/SBOM work, Apache notices | Signed/reproducible artifacts and container scanning are not complete (B5/E7) |
| T26 | “Same version, different content” publish or stale artifact | High — consumer gets unaudited code | Release process | Version bump checks, package validation, flat-install gate, dist-tag checks | Process is partly manual; release automation needs hardening (E2/E7) |
| T27 | Old PASS log or simulator result presented as live evidence | High — false production claim | Canary/evidence | Pinned SHA, execution-level labels, evidence schema | Canary v1 gate is still being implemented |
| T28 | Operator runs unsafe defaults (public RPC, no auth, weak TLS) | High — remote compromise | Node/host deployment | Bearer auth for non-loopback, origin checks, documented deployment guidance | Secure-by-default deployment still depends on operator configuration |
| T29 | Privacy leakage through telemetry, logs or metadata | Medium — user deanonymization | Wallet, host, lookup, relay | No seed/private-key logging policy, local storage, bounded registries | No formal privacy guarantee; traffic analysis remains |

---

## 8. Current residual risks

The following are explicitly accepted **for the current pre-1.0 state** or remain
open:

- No independent security audit of the current code (RFC-063 B2).
- Tier 1 runtime evidence is incomplete; Canary remote-live gates are pending.
- No HIL evidence for industrial/MQTT/Modbus claims.
- No mainnet or value-bearing production claim.
- Crash/power-loss, restored-backup and corruption recovery evidence is
  incomplete for storage and host state.
- WOTS leaf-reuse prevention is only as strong as the lease/watermark storage and
  operator recovery procedure.
- The browser extension and local malware boundary cannot be fully defended by
  the SDK alone.
- Economic/routing adversaries and long-running liquidity behavior are not
  sufficiently characterized.
- Privacy is bounded; relay/DHT metadata and chain correlation remain.
- Build/release signing, reproducibility and dependency scanning are not complete.
- Outside/Tier 3 packages are not covered by this model's production claims.

---

## 9. Security requirements for deployers

1. Keep seeds and wallet-service keys off coordinator hosts.
2. Use TLS and authentication for every non-loopback RPC endpoint; never expose
   an unauthenticated control plane.
3. Restrict control-plane and database access to the minimum operator network.
4. Back up durable state and test restore with the watermark/ticket rules; never
   restore an older state over a newer one blindly.
5. Monitor WOTS watermark/lease health, signer audit events, operation failures
   and disk health.
6. Use separate identities/keys per host and per environment.
7. Patch dependencies and the node promptly; treat cryptographic dependency
   changes as security changes.
8. Run testnet/small-value pilots before any mainnet value.
9. Require HIL evidence before claiming physical-effect safety.
10. Treat Canary artifacts, not dashboard summaries, as release evidence.

---

## 10. Verification and review

This model is linked from `SECURITY.md` and is reviewed when:

- a Tier 0/1 package changes its trust boundary or signing path
- a new attacker capability or incident is reported
- a new persistence, replication or P2P transport is adopted
- a production/Tier 0 promotion is proposed
- an independent audit is completed

The model is **not** an audit. The Phase 1 gates remain:

- B2 independent audit
- B3 fuzz/property targets — initial targets in [fuzz-targets.md](fuzz-targets.md)
- B4 tested recovery/rotation/compromise runbooks
- B5 SBOM, signed/reproducible artifacts and dependency scanning
- B6 vulnerability/advisory process
- B7–B9 remaining policy and enforcement work

Until those gates and the Phase 2 evidence pass, the SDK must not describe the
whole repository as production-ready.
