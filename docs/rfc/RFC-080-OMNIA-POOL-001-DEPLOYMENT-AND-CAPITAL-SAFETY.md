# RFC-080: Omnia Pool 001 — Deployment Architecture, Capital Safety and Commercial Acceptance Gates

**Status:** Proposed — commissioning may begin; funded deployment and external LP admission are gated.
**Date:** 2026-11-24
**Scope:** Omnia SDK consumers, deployment infrastructure, security qualification and commercial operations.
**Priority:** P0 for capital safety; P1 for commercial expansion.
**Supersedes:** Nothing.
**Related:** RFC-035 (peer coordination), RFC-036 (settlement verification), RFC-037 (unified WOTS), RFC-038 (VTXO), RFC-039 (custody conformance), RFC-048 (primitive completeness), RFC-055 (routing), RFC-058 (custody disclosure), RFC-061 (custody enforcement), RFC-062 (provider parity and mode isolation), RFC-063 (production readiness), RFC-068 (onion routing), RFC-078 (authorization and one-time keys), RFC-079 (factory escape).

## 1. Summary and decision

Omnia Pool 001 is the first proposed commercial deployment of the Omnia liquidity infrastructure, initially operated with Totem-owned MINIMA. It shall be a bounded engineering and operational commissioning project before becoming an external liquidity product.

The SDK now contains the three distinct layers required for this project: provider trust (`provider-bond`), LP position/receipt accounting (`liquidity-bond`), and pool orchestration (`omnia-pool`). The execution family already includes channels, routing, relay, host, factory, splice and VTXO primitives. The next investment should be integration and acceptance evidence, not another generic pool package.

**Proposed decision:** start commissioning on an isolated chain with no external capital. A capped, founder-funded mainnet pilot may be approved only after the applicable acceptance gates in §12 pass. External LP admission, stable-asset routing and advanced allocation are separately gated. This document is not authorization to fund an operation, publish a package, promise returns, or accept deposits.

| Stage | Position as of this review |
|---|---|
| Deployment repository and simulated/isolated-chain engineering | Go |
| Founder-funded mainnet routing pilot | Conditional; not yet approved |
| External LP admission | No-go until separate custody, accounting, withdrawal and legal gates pass |
| Public pool/network | No-go |

A release candidate, a closed finding, a green unit suite or a signed receipt is not equivalent to a funded network acceptance result.

## 2. Motivation and goals

Pool 001 should demonstrate that MINIMA can be productively deployed in Omnia payment channels, that independently operated endpoints can route payments, that earned fees are attributable to completed operations, and that the operator can recover and reconcile capital even when peers or hosts fail.

Success is an operating infrastructure service with reproducible evidence of capital safety, liveness, economic performance and user utility. It is not an AMM, a token launch, a new L1 staking mechanism or a guaranteed-yield product.

Goals:

- Demonstrate direct bilateral MINIMA funding, payment, settlement and recoverable multi-hop routing.
- Demonstrate end-to-end pool accounting against actual funding, deployment and payout evidence.
- Reuse the existing SDK family, storage, identity, manifests, proofs and transports.
- Expose auditable operational metrics, capital exposure, available liquidity, verified fees and incidents.
- Establish a conservative, reproducible release gate for future commercial deployments.
- Preserve local/self-hosted participation without mandatory provider bonds or a TOTEM token.

Non-goals for Alpha: external LP deposits, public fundraising, anonymous pooled investment, stable-token conversion, factories, VTXO allocations, statechain allocation, RFQ execution, autonomous capital deployment, slashable productive collateral and new token issuance. Research and diagnostics for these capabilities may proceed without enabling them in the Alpha profile.

## 3. Baseline and evidence classification

Baseline: SDK main at [cfaae0ed](https://github.com/Totem-Edge/totem-sdk/commit/cfaae0eda2abebf7e5cc766d36fb901c199e26ee), 2026-11-23. Versions are workspace versions, not an assertion that all are available on npm latest or next. Pin and verify exact published artifacts or reproducible workspace artifacts before commissioning.

| Package | Baseline version | Role |
|---|---:|---|
| `@totemsdk/omnia` | 3.0.0 | Bilateral channel state machine and settlement |
| `@totemsdk/omnia-host` | 0.15.1 | Host lifecycle, durable state, observation, RPC |
| `@totemsdk/omnia-router` | 0.5.0 | Routing graph, HTLC path selection |
| `@totemsdk/omnia-relay` | 0.10.0 | Wallet coordination and forwarding |
| `@totemsdk/omnia-factory` | 0.8.0 | Factory allocation and escape paths (disabled in Alpha) |
| `@totemsdk/omnia-splice` | 0.3.5 | Funding adjustment (disabled in Alpha) |
| `@totemsdk/omnia-vtxo` | 0.9.0 | Virtual UTXOs (disabled in Alpha) |
| `@totemsdk/omnia-pool` | 0.6.2 | Pool orchestration |
| `@totemsdk/liquidity-bond` | 0.4.0 | Position ledger, receipts, allocations, fees, withdrawals |
| `@totemsdk/provider-bond` | 0.2.2 | Provider identity and reputation |
| `@totemsdk/statechain` | 0.3.3 | Future ownership-transfer backend |
| `@totemsdk/wots-lease` | 1.0.3 | One-time signing key safety |

All are RC in the baseline maturity catalogue; support tiers differ. See [maturity.md](../maturity.md) and [SDK_MANIFEST.json](../../SDK_MANIFEST.json). Exact dependency ranges MUST be resolved together; the 22 November release fix [10224b88](https://github.com/Totem-Edge/totem-sdk/commit/10224b88c5b3626b721b590fb0144222c437487e) exposed incompatible published Omnia-family ranges.

### 3.1 Evidence already present

- SDK PR [#207](https://github.com/Totem-Edge/totem-sdk/pull/207) records an isolated-chain funded two-host open/pay/settle exercise and a second channel with concurrent payments and restart recovery. This is historical, narrower-path evidence, not current-version qualification.
- [238ffbe1](https://github.com/Totem-Edge/totem-sdk/commit/238ffbe1cdfa2fdc902a283e603d221158cd8629) and [63f1cada](https://github.com/Totem-Edge/totem-sdk/commit/63f1cada) close numerous authorization, persistence, amount-unit, witness, HTLC, funding and VTXO findings. Re-run original reproductions; do not infer all paths are safe.
- [065b4a17](https://github.com/Totem-Edge/totem-sdk/commit/065b4a17887e63fb5ac7d9bf1f72d964fd5bcc94) wires wallet intermediary forwarding, serializes per-hop timeout bounds and derives capability claims. [3f47ab60](https://github.com/Totem-Edge/totem-sdk/commit/3f47ab60eaa93774be39cabe9b07564158598f8b) adds fail-closed time-boxed approval queues.
- Canary gate-integrity, independent receipt/amount decoding and signing crash tests have landed. Its Scenario 50 uses two real host lifecycles but linked in-process transport; it remains diagnostic rather than independent-process/live-swarm acceptance. See [Canary gate changes](https://github.com/Totem-Edge/Totem-Edge-Canary/commit/1f8c65a160a6b7fb3ed8970aacd0f41146360766) and [two-host test](https://github.com/Totem-Edge/Totem-Edge-Canary/commit/ea95efa0a47d6d219b8e700e88d7fe45d055ed0f) (repository access may be required).
- The [S10 host harness](../../scripts/omnia-s10-host.mjs) exercises pool lifecycle accounting but uses fixture funding/finality evidence. It is not the funded lifecycle gate.
- RFC-079 checkpoint/distribution enforcement has progressed; the Canary records OMN-058 closed at the covenant level with host checkpoint submission outstanding. Host N>2 factory opening remains explicitly rejected in the reviewed evidence. Watch handlers have been hardened, but host-level recovery acceptance remains required. Recheck current findings rather than treating this snapshot as authoritative forever.

### 3.2 Readiness gap

The review inspected repository source, commits and recorded test evidence; it did not execute the pinned suites or deploy funded hosts. It is not a security audit certificate. The next qualification run must identify every result as unit, simulated, process-real, live-network/test-chain, or funded-mainnet evidence. A diagnostic result may not satisfy a stronger gate.

## 4. Architecture and package ownership

```text
Pool 001 deployment / control / dashboard
  |-- provider-bond: operator identity, verified trust evidence
  |-- omnia-pool: orchestration, allocation, reconciliation
  |     |-- liquidity-bond: position ledger, receipts, allocation and fee records
  |     |-- agent-policy: bounded authorization
  |     '-- execution adapters: omnia / router / host / relay
  |          (factory / splice / vtxo / statechain only in later profiles)
  |-- storage: durable operational state and journals
  |-- manifest / identity / proof: signed declarations and evidence
  |-- wots-lease / signer: one-time key coordination
  '-- chain-provider / independent observer: funding and settlement verification
                    |
                 Minima L1
```

This is a deployment composition diagram, not a literal npm dependency graph. The deployment MUST use public SDK APIs where possible, correct generic defects upstream and avoid copying protocol, serialization, signing or accounting code into application glue. Use the existing pubsub/stream abstractions where applicable; do not introduce a separate network protocol merely for Pool 001.

The proposed consumer repository is `Totem-Edge/omnia-pool-001` (not created by this RFC). It should own environment configuration, deployment profiles, signed operating policy, runbooks, a dashboard, test orchestration, reproducible evidence and release controls. No secrets, wallet seeds, live credentials or customer records belong in source control.

### 4.1 Trust boundaries

- Provider/operator and payer/payee wallets are separate principals with independent keys and durable state.
- The operator can only sign for its own allocated capital under the applicable policy.
- A relay, lookup service or telemetry feed cannot authorize spending.
- An independent chain observer verifies funding, finality, canonical chain and reorg status; an RPC response from the operator alone is not sufficient independent evidence.
- The watcher may submit a pre-authorized valid recovery transaction but MUST NOT have unrestricted spending authority. Recovery availability and key/receipt handling must be qualified.
- Administrative access, signing access and read-only dashboard access are separated. Hosting a signer changes the actual custody exposure; RFC-058 and RFC-061 apply regardless of the package's advertised classification.

## 5. Capital and custody model

Three concepts are distinct:

1. Provider security collateral: capital subject to actual enforceable restrictions and, if advertised, a demonstrated penalty mechanism.
2. Productive liquidity: channel-side capital deployed for payments; capacity and balance change over time.
3. LP ownership/claims: capital attribution and withdrawal rights, supported by verifiable backing and enforceable exit arrangements.

The current `provider-bond` and `liquidity-bond` packages are data-only. A declaration, signature, receipt, visible balance or policy lock does not establish on-chain escrow, slashing, insolvency protection or an enforceable LP exit. Omnia's channel scripts and later execution backends are separate custody boundaries. Actual control of keys, unilateral exits, and worst-case recovery MUST be evaluated for the deployed path.

The initial operator uses only its own treasury capital. External user channel balances are not pool-owned assets. A founder-owned channel counterparty is not a substitute for testing independently controlled wallets.

### 5.1 Alpha capital policy

Define a signed, versioned policy per network and asset:

- Maximum aggregate at-risk MINIMA, maximum funding per channel, maximum individual payment, maximum in-flight HTLC exposure and maximum cumulative outflow per policy window.
- Minimum undeployed reserve and recovery/fee buffer.
- Maximum number of active channels, maximum fee per action, allowed counterparty list, permitted execution profile, confirmation depth, maximum evidence age and minimum contest margin.
- Independent authorization for cap increases; no automatic increase based on apparent fee income.
- Separate treasury reserve from channel funding. A reserve is not a provider security bond unless independently proven to be one.

Illustrative allocation only (not a mandated risk limit or investment amount): 25% undeployed reserve, 50% productive routing, 25% rebalancing/exit buffer. Determine actual limits from test results, liquidity direction and acceptable loss; no capital value is approved here.

### 5.2 Accounting invariants

Use canonical token identity (network + token ID), integer atom amounts and explicit RPC decimal conversions. Never aggregate unlike assets as if fungible. Maintain separate totals for treasury reserves, confirmed deployed principal, operator-side channel balances, pending outgoing/incoming HTLCs, realized fees, settlement fees, pending withdrawals and disputed/unreconciled capital. Do not count capacity belonging to counterparties as operator capital.

- One backing coin or explicitly partitioned entitlement may support only one allocation of each economic unit.
- A successor coin or channel state replaces, not duplicates, its predecessor.
- Allocations plus unallocated balance and reserved claims must reconcile to the verified current position; pending effects must not be counted twice.
- Fee income is recognized only against a completed, verified source event, net of attributable costs for profit reporting; unrealized quotes and attempted routes are not income.
- A withdrawal request, approval or draft is not a payout. Debit capital and consume the receipt only after independently verified exact finality.
- Any reorg, stale state or unresolved divergence freezes affected spending and marks the amount uncertain. Recovery must be evidence-driven, never an arbitrary ledger edit.

## 6. Alpha operating profile

| Feature | Alpha |
|---|---|
| Funding | Totem-owned MINIMA only, hard capped |
| Channels | Direct bilateral channels |
| Routing | Same-asset multi-hop only after G04 |
| External LP deposits and payout access | Disabled |
| Cross-token swaps, RFQ and stable-value services | Disabled |
| Factories, VTXOs, statechains and splice allocations | Disabled |
| Rebalance | Explicit manually approved operation within caps |
| Fees | Recorded only for verified completed routes |
| Privacy | Do not claim onion/path privacy |
| Monitoring and emergency pause | Mandatory |

Use an isolated reference chain first. Hawk Node may be qualified as a backend, but MUST NOT be the sole basis of finality until relevant high/critical findings (including the historically recorded CAN-023 if still applicable) are resolved and provider/parity/reorg behaviour is verified. Reference-node interoperability is mandatory for fund-affecting scripts and wire amounts.

Minimum topology: independent payer, Pool 001 router and payee, each with its own signer, process, durable store and transport identity. A second independent observer/watch process must be able to reconstruct settlement evidence. Expand topology only after the minimal route works.

### 6.1 Operation lifecycle

```text
prepare -> validate verified state -> authorize exact effect -> reserve/lease
        -> sign -> persist signed intent and recovery material -> submit/forward
        -> observe peer/chain -> verify effect/finality -> reconcile -> commit
                                              |-- uncertain -> pause/recover
                                              '-- rejected -> abort/release safely
```

Use operation IDs, network/profile identity, canonical transaction/action digest, expected predecessor, idempotency keys and durable recovery state. Repeat submission may return the existing result; it must not create a second economic effect. An ambiguous submission is not a failure that permits blind resubmission. The implementation must reuse the existing channel/WOTS journal and signing machinery, not build an alternative.

## 7. P0 implementation and qualification gaps

### 7.1 Independent multi-host routing

RFC-035 B4/B5 forwarding and approvals are now implemented. Prove actual funded traffic across three separate processes over the selected production-like transport. Check sender debit, receiver credit, intermediary net fee, strict decreasing timeouts, preimage propagation, no success before terminal evidence, retry/idempotency, missing route, insufficient liquidity, expiry, disconnect and restart. Verify no participant loses principal in a failed route except explicitly authorized transaction fees.

### 7.2 Funded pool lifecycle

Replace fixture-only S10 evidence with a real-chain funded scenario: LP/treasury authorization, confirmed funding, position and receipt, allocation into a real bilateral channel, routed traffic, observed fees, quiesce/release, withdrawal intent/approval, actual payout and independent reconciliation. In Alpha this may use a treasury-owned test position; this is not permission to accept outside funds.

### 7.3 Finality and durable accounting

Current [withdrawal implementation](../../packages/omnia-pool/src/withdraw.ts) rejects unverified settlement and binds evidence to withdrawal, pool, position, recipient and amount. The [host API](../../packages/omnia-host/src/api/methods.ts) requires a configured settlement verifier. Prove the deployment actually installs a trusted verifier, and that the verifier checks canonical chain, depth, token, destination, amount and unique consumption of evidence. Off-chain finality MUST be independently authenticated against the current enforceable state when allowed by the profile.

Verify durable state across process termination, duplicate request, crash between evidence and accounting commit, stale snapshot, and chain reorg. A payout retry must never reduce a receipt twice or send a second payment. Where evidence is missing, return explicit pending/unknown and do not commit a debit.

### 7.4 Provider-bond scoring and evidence

At the baseline, [scoring.ts](../../packages/provider-bond/src/scoring.ts) awards full identity score for a declared bond owner address, and full bond score for an active hard-collateral declaration with a nonempty proof list. This is a trust-model gap: existence of a claim/proof record is not verified identity or locked collateral.

Before a score is used to admit an external provider or allocate third-party funds:

- Distinguish declared, signature-valid, identity-authorized, chain-verified and enforceably locked evidence.
- Require verified identity and correctly bound, asset-specific, fresh bond evidence for eligibility; fail closed on missing, expired or unsupported verification.
- Bind proof to provider, bond, amount, asset, network, current coin/state, ownership, lock terms and confirmation context; prevent duplicate collateral.
- Score only verified inputs for security eligibility; treat no probe history as unknown and separate observation confidence from reliability.
- Add regression vectors for forged/self-issued proofs, wrong provider/asset, missing lock, duplicate backing, stale/revoked identity and future-dated observations.

For a founder-only Alpha, do not use provider score as a capital authorization signal; use a static allowlist plus verified identities. Record the defect and remediate upstream. If any Alpha component uses the score as a security gate, this becomes a blocking Alpha requirement.

### 7.5 Watcher and unilateral exit

Prove real stale-state contest, unilateral settlement and HTLC expiry using valid canonical witnesses and authoritative heights. Kill the operator at the worst permissible time, restore from durable state and demonstrate the independent recovery path within the contest margin. Validate against real-node KISSVM, not solely mocked signature dispatch. Missing recovery data, stale chain views or watcher lag beyond policy limit trigger pause.

### 7.6 Deferred features and known constraints

Factories: do not enable until checkpoint submission is wired, confirmed allocation changes are enforced, and cooperative and unilateral exit recover the latest enforceable state. More-than-two-party host opening and off-chain allocation changes require separate qualification. RFC-079 governs the design.

VTXO/splice/statechain: prove backing, amount conservation, per-owner exit and correct witness/confirmation semantics before activation.

Private routing: RFC-035's cleartext envelope must not be described as onion-private. RFC-068 and its portable encryption/key prerequisites remain separate. Cross-token routing requires a funded atomic success/failure gate, exact quote and fee accounting, and an identified accepted token.

## 8. Operational service and dashboard

Reuse the host observation journal and authenticated read-only snapshot/SSE surfaces. See [omnia-host README](../../packages/omnia-host/README.md). The observation feed is telemetry, not accounting authority; asynchronous observation may lag a mutation.

Dashboard minimum fields:

| Area | Required metrics |
|---|---|
| Treasury | confirmed reserves, deployed owned capital, pending/uncertain amounts, exposure versus caps |
| Channels | peer, token, confirmed funding, local/remote balance, outbound/inbound capacity, pending HTLCs, state sequence |
| Routing | attempts, verified successes, failure reason, volume, latency, fee income and costs |
| Pool ledger | positions, receipts, allocation status, verified realized fees, pending withdrawals, reconciliation differences |
| Safety | signer/lease watermark, watcher lag, chain tip freshness, confirmation depth, unresolved findings, pause status |
| Evidence | deployment version, profile, scenario run ID, source references, last independent reconciliation |

Separate actual observed values from simulations and unavailable data. Never publish secrets, raw signatures, preimages, credentials or sensitive peer/customer data; redact or hash where appropriate. Require authenticated administration, restricted network binds, least privilege, backups and documented restoration.

## 9. Control and incident response

Emergency pause must stop new funding, allocation, new payments/forwarding and autonomous signing as applicable, without disabling essential safe settlement, HTLC recovery or contest paths. Quiesce and drain rather than blindly terminate in-flight obligations.

Trigger pause on: chain observer disagreement, stale tip, reorg affecting funding, unknown payout, ledger mismatch, invalid signature, lease conflict, unexplained balance loss, watcher unavailable, breached cap, new relevant high/critical finding or unexpected capability enabled.

Runbook: stop exposure; preserve durable journal and exact signed states; identify affected channels and leases; verify against independent observer; recover or settle using approved paths; reconcile; document incident and independent review; require explicit re-enable authorization. Do not restore a key store to an older watermark or reuse a leaf. Test backup restore with a deliberately stale snapshot.

## 10. Commercial rollout

| Phase | Profile | Promotion condition |
|---|---|---|
| A0 | Isolated-chain commissioning | Pinned artifacts, profiles, diagnostic and full acceptance suite |
| A1 | Capped founder-funded MINIMA routing | Alpha gates pass; explicit approval of risk caps, operator and chain |
| B | Stable-value merchant routing | Verified token identity, funded cross-token atomicity, quote expiry/slippage/fee limits and merchant settlement reconciliation |
| C | Invited founding LPs | Independent custody/exit and accounting evidence, verified provider eligibility, legal review, participant disclosures and explicit external-capital approval |
| D | Advanced liquidity | Backend-by-backend factory/VTXO/splice/statechain gates, governed rebalance and enforceable productive collateral if used |
| E | Public liquidity network | Independent operators, discovery, sustained audited operation, commercial/legal approval |

A1 does not require B–E to be implemented. B and C may be independently sequenced according to evidence and demand; neither is implicitly authorized by A1. No TOTEM token is required. MINIMA remains the initial settlement/liquidity asset. Future optional TOTEM service/governance bonds are outside this RFC.

### 10.1 Economics

Track actual fees per routed asset, success-adjusted volume, net realized income after chain/rebalance/hosting costs, capital utilization, capital immobilization duration and recovery cost. Routing revenue is not guaranteed. Benchmark fee policies with controlled traffic and distinguish synthetic test volume from actual merchant demand.

For external LPs, any fee distribution must be explicitly attributable, independently auditable, disclosed and legally reviewed. Do not advertise APY from synthetic or short-run test data. A data-only receipt cannot itself confer enforceable ownership or guaranteed redemption.

## 11. Proposed deployment repository

```text
omnia-pool-001/
  README.md
  config/                  # versioned network/profile and signed risk limits
  deploy/                  # reproducible services, independent processes
  src/
    bootstrap/             # pinned SDK adapters and capability checks
    pool/                  # orchestration composition, not a new protocol
    policy/                # signed limits and allowed operations
    reconcile/             # independent evidence and conservation checks
    observe/               # host snapshot/SSE consumers
    control/               # authenticated pause/quiesce/recovery controls
  dashboard/               # read-only operational views
  acceptance/              # isolated/live-transport scenarios; Canary integration
  runbooks/                # incident, restore, key safety, exit, upgrade
  evidence/                # redacted manifests and results, no private keys
```

Implementation order: pin versions and run package gates; build topology/config; run single channel then independent three-party routing; add durable reconciliation and monitoring; qualify funding-to-withdrawal lifecycle; qualify failure and recovery; perform soak; present evidence and risk caps for approval. Only then enable mainnet mutation mode for A1.

No new generic SDK package is authorized by this RFC. A reproducible failure in an SDK primitive must be fixed in its owning package and the complete relevant acceptance suite rerun.

## 12. Acceptance contract

Every gate starts **not evaluated** for the pinned deployment. Historical evidence is useful but not sufficient. The proposed A1 gate runs on an isolated chain with actual confirmed test capital and independently controlled processes; any mainnet smoke after approval must be separately bounded and may not increase exposure automatically. Evidence includes command, version/commit, network, process identity, input, result, independent receipt/state verification and negative controls.

| ID | Required gate | Minimum acceptance |
|---|---|---|
| G01 | Exact artifact family | Clean install, reproducible lockfile, supported exports/ranges, maturity/custody/findings checks |
| G02 | Mode isolation and limits | Test/mainnet separation, disabled features rejected before effects, cap/authorization negative controls |
| G03 | Funded bilateral channel | Independent hosts agree on funding script/coin, parties, amount and state; pay and settle on real test chain |
| G04 | Funded multi-hop | Three independent hosts, live transport, terminal recipient credit, exact fee and timeout accounting; insufficient-liquidity/expired/tampered route fails safely |
| G05 | Crash and restart | Kill each relevant process around signing, persistence, send, ACK and finality; replay idempotent; no lost state or reused leaf |
| G06 | WOTS and identity | Authenticated peers, signer/lease persistence, disjoint unconsumed leaves; wrong signer, stale lease and replay rejected |
| G07 | Independent chain evidence | Confirmed funding and settlement, exact asset/amount/recipient, independent node decode and KISSVM parity; reorg/stale/fabricated evidence rejected |
| G08 | Watch and exit | Real stale-state contest, unilateral close and HTLC expiry within configured safety margins; operator offline recovery |
| G09 | Verified fee accounting | Every recognized fee binds to a unique completed route and correct asset; no credit for failed/duplicate events |
| G10 | Funded S10 lifecycle | Treasury test position, receipt, deployed capital, fees, unwind, withdrawal, independently confirmed payout and capital reconciliation |
| G11 | Payout/funding adversarial | Wrong coin, duplicated backing, forged finality, wrong amount/token/recipient, replay and crash at settlement rejected or reconciled once |
| G12 | Operations | Emergency pause, quiesce, alerts, cap enforcement, backup restoration and recovery runbooks demonstrated |
| G13 | Soak | Proposed minimum seven continuous days on isolated chain under documented traffic, churn and fault injection; no unresolved conservation violation or critical recovery failure |
| G14 | Findings and release approval | No unresolved relevant high/critical findings; evidence review and explicit human approval of deployment profile and loss/exposure caps |

G01–G14 are A1 blockers. A failed, missing, skipped, deferred or diagnostic-only required scenario is not a pass. Seven days is a proposed minimum, not a guarantee of security. Thresholds (confirmation depth, traffic mix, latency/availability objectives, timeout budget, exposure caps) must be fixed in the signed test profile before the run, not retrospectively adjusted to pass.

### 12.1 Evidence manifest

Each release candidate should have a machine-readable evidence manifest containing at least:

```text
candidateId, sdkCommit, lockfileDigest, packageVersions, buildArtifacts,
networkId, nodeVersions, topology, signerMode, profileDigest,
gateId, requiredEvidenceLevel, observedEvidenceLevel, scenarioIds,
startedAt, finishedAt, status, negativeControls, receipts,
reconciliationDigest, openFindings, reviewerDecision
```

Status values: not-run, passed, failed, blocked, diagnostic. Only passed at the required level may count. Store sensitive underlying evidence privately; publish redacted summaries where appropriate. Never store private keys or raw preimages.

### 12.2 Additional external-capital gates

In addition to G01–G14, external LP admission requires:

- A proven enforceable backing and exit model for each supported allocation, including operator absence, insolvency/compromise threat model and independently controlled LP exits where claimed.
- Independently reviewed LP ownership/receipt accounting, partial and full withdrawals, fee claims, competing requests, concurrent allocation and withdrawal, duplicate proof/payout handling, and reorg recovery.
- Provider scoring remediation in §7.4 and current verified security collateral if required by policy. Productive liquidity may not be counted as hard collateral merely because it has a position receipt.
- Applicable legal/regulatory assessment, contractual risk disclosures, fee terms, appropriate onboarding and explicit authorized commercial decision.
- Independent security review scoped to the actual deployed capital-bearing paths and documented residual risk acceptance.

## 13. Alternatives

**Wait until every Omnia extension is implemented:** rejected as an Alpha prerequisite; it delays learning and increases coupling. Advanced features remain explicitly disabled.

**Launch a public LP pool immediately:** rejected; records, RC maturity and fixture tests do not establish enforceable backing or recovery.

**Build another general pool SDK:** rejected; existing `omnia-pool`, `liquidity-bond` and `provider-bond` already define the appropriate responsibilities. Build deployment composition and fix the primitives upstream.

**Use all treasury liquidity as a provider bond:** rejected unless actual enforceability, attribution and recovery are separately proven. Productive deployment and security collateral are different claims.

## 14. Open decisions and next actions

- Select reference node and qualified secondary backend, independent watcher/observer topology, signer mode and transport profile.
- Agree Alpha risk caps, initial capital (if later authorized), minimum depth, timeout and recovery margins, fee schedule and operational SLOs.
- Assign owners for G01–G14; wire the funded lifecycle and independent transport gates into Canary.
- Confirm latest registry findings, including checkpoint and watch-handler acceptance; retest original findings on the pinned release.
- Decide external-capital custody model, legal jurisdiction and incentive policy only after Alpha evidence.

## 15. Resolution status

Proposed. The authoring review establishes the direction and a conditional gate, not completion. No launch gate is recorded as passed by this RFC. No funds are authorized. No new repository or SDK package is created by this RFC.

The next deliverable is the Pool 001 commissioning repository and a reproducible G01–G14 evidence bundle. Promotion to founder-funded mainnet operation requires explicit approval after the evidence is reviewed.
