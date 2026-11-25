# RFC-081 — Omnia LSP: Provider Discovery, Capacity Onboarding and the Capacity Marketplace

**Status:** Draft — Phase 0/1 partial. `@totemsdk/omnia-lsp` (manifest/quote/ranking), `@totemsdk/omnia-lsp-provider` (policy/quote + `omnia-host` adapter), the wallet-side funding-witness port, the Omnia lease path, and MOKA's open-capacity flow have landed. Omnia defaults to durable local lease storage; an explicit `OMNIA_AXIA_LEASE=true` opt-in uses the Axia hardened lease adapter. The provider-funded host open → pay → settle → close e2e passes on AWS A/B (2026-11-25). The remaining gates are live-Axia verification of the opt-in path and the consumer extension wallet ↔ provider host e2e.
**Priority:** P1 (onboarding and liquidity)
**Created:** 2026-11-23
**Authors:** Totem SDK Contributors
**Depends on:** RFC-002 (Omnia channel state machine), RFC-014 (wallet connect parity), RFC-034 (Omnia relay method parity), RFC-035 (peer coordination), RFC-037 (Omnia channel identity), RFC-048 (Omnia primitive completeness), RFC-055 (routing architecture), RFC-058 (custody modes and disclosure gate), RFC-059 (discoverable liquidity), RFC-064 (off-chain principles), RFC-069 (same-chain submarine swaps), RFC-071 (announcement envelope and discovery consolidation)
**Touches:** `omnia`, `omnia-host`, `omnia-router`, `omnia-splice`, `omnia-factory`, `connect`, `manifest`, `provider-bond`, `liquidity-bond`, new `omnia-lsp`, new `omnia-lsp-provider`, MOKA (external consumer), Axia (first hosted provider)
**Proposes:** An open protocol and Apache-2.0 reference implementation for Omnia Liquidity Service Providers (Omnia LSPs) — signed provider manifests, deterministic ranking, wallet-built channel funding, provider co-signing, channel lifecycle, and a staged path to just-in-time/submarine onboarding. It does not authorise a custodial service, a production claim, or a new consensus rule.

---

## 1. Problem

Omnia has no usable first-run path.

A new user can connect a wallet, read balances and read channels, but cannot open a channel without already knowing a counterparty. The current state is:

| Area | Current state | Gap |
|---|---|---|
| MOKA | Reads `omniaGetChannels`; no open-channel call or UI | No onboarding journey |
| Totem extension | No open-channel UI | Wallet cannot initiate a channel |
| `@totemsdk/connect` | `omniaOpenChannel` now exposes `remotePublicKeyDigest`, settlement/transport fields, amounts and `fundingCoinId` | Provider/quote wiring still needs a caller (MOKA) |
| Wallet-side open | `omnia/src/relay-client.ts` requires a wallet `FundingWitnessBuilder`; dApp `fundingWitnessHex` is rejected | Extension must supply coin proof + address script for the active chain provider |
| Axia-mode Omnia | Omnia defaults to a durable **local** lease store; an explicit `OMNIA_AXIA_LEASE=true` opt-in uses `OmniaAxiaLeaseProvider` (`/wots-hardened/prepare` + `/consume`), and `HostedProvider` + `/wots-hardened/coinproofs` supply funding proofs | Needs live-Axia verification of the opt-in remote path, `getCoin` confirmation and a review of the 10/day WOTS quota |
| Provider discovery | None | No way to choose a counterparty |
| Swap liquidity | `getSwapRate` reads the wallet graph | No swap announcements are injected |
| Channel factories | N-of-N among known participants | Not a channel vending machine |
| SE server | Statechain blind-signing entity | Not a channel counterparty |
| Submarine/JIT open | RFC-069 proposed, not started | No on-chain → channel onboarding |

MOKA is the demand side. There is no supply side: no providers, no manifests, no ranking, no open/lease execution, no lifecycle. A dashboard over channels that someone else created is not an onboarding product.

---

## 2. Decision

1. Adopt an open **Omnia LSP protocol** for provider discovery, capacity terms, channel opening and lifecycle.
2. Canonical spec and Apache-2.0 reference implementation live in `totem-sdk`. Axia is the first hosted provider/operator, not the spec owner.
3. Add two packages:
   - `@totemsdk/omnia-lsp` — protocol types, manifests, registry client, ranking, quote/state machines.
   - `@totemsdk/omnia-lsp-provider` — reference provider/host.
4. Fix `@totemsdk/connect` `omniaOpenChannel` so the **wallet** builds and signs the funding witness. A dApp or provider MUST NOT supply it. *(Landed: the connect contract now carries the remote channel identity, the relay operation requires a wallet `FundingWitnessBuilder`, and dApp `fundingWitnessHex` is rejected.)*
5. Bootstrap with a curated launch provider. Open the registry only after the two-party open/pay/close path is proven end-to-end.
6. Add JIT/submarine onboarding (RFC-069) only after direct provider opening works.
7. Keep the protocol open, versioned and conformance-tested. Keep hosted operations, liquidity and capital strategy commercial.

---

## 3. Goals

1. A new user with on-chain MIN can obtain usable Omnia capacity in one guided flow.
2. The user keeps their keys. A provider can co-sign and route, but cannot move the user's funds alone.
3. Providers can publish signed terms and be discovered, ranked and selected without a central gatekeeper.
4. Channel opening is safe against witness substitution, funding-coin substitution, replay, stale quotes and fee griefing.
5. A provider that goes offline does not strand the user; cooperative and unilateral exit paths are explicit.
6. The same protocol serves MOKA, other wallets, merchants and dApps.
7. The design has a clear path from direct provider channels to JIT/submarine onboarding and provider-side factories.

## 4. Non-goals

- Custodial accounts or a hosted wallet.
- Fiat on-ramp, KYC or card processing.
- A new AMM, order book or matching engine.
- Cross-chain bridges.
- Replacing the Omnia channel state machine or its cryptography.
- An enforceable on-chain bond in Phase 1. `provider-bond` v0.1 is data-only; an on-chain collateral-bond covenant is a separate capability.
- A production claim before RFC-063 gates and real-node recovery evidence.

---

## 5. Terms

**Omnia LSP (Liquidity Service Provider):** an operator that publishes Omnia capacity, opens/leases channels to consumers, and may route or swap. Not a custodian.

**Consumer:** a wallet, dApp, merchant or agent that wants Omnia capacity.

**Capacity:** the ability to send (outbound) or receive (inbound) a given asset over Omnia channels.

**Provider manifest:** a signed declaration of identity, endpoints, channel keys, assets, capacity, fees, terms, bond references and custody disclosure.

**Registry:** a discovery surface for provider manifests. A registry is not a custodian and does not guarantee liquidity.

**Quote:** a provider-signed, expiring offer binding asset, amounts, fees, provider channel identity and terms.

**Lease:** a channel where the provider funds a larger share of the capacity in exchange for a fee.

**JIT (just-in-time) open:** capacity created as part of the first payment or swap, without a separate open step. See RFC-069.

**Funding witness:** the signed witness for the channel funding input. It MUST be produced by the wallet that owns the funding coin.

**Watchtower:** a service or local process that monitors channels and broadcasts a unilateral close when a counterparty withholds or disappears.

---

## 6. Roles and trust boundaries

```text
Consumer wallet ── relay ── Provider host
       │                        │
       ├── chain provider ──────┤
       │                        │
   Registry (discovery)     Liquidity / routing
```

| Role | Can move user funds? | Trust assumption |
|---|---|---|
| Consumer wallet | Yes, by user signature | User-held keys |
| Provider | No, alone | Counterparty and liveness risk |
| Registry | No | Censorship and ranking risk |
| Relay | No | Availability and metadata privacy |
| Chain provider | No | Correct chain reads; wallet verifies signatures |
| Watchtower | No | Liveness assistance, not custody |

The protocol is **non-custodial, not trustless**. A provider can refuse to co-sign, censor routing or go offline. It cannot spend the user's side of a 2-of-2 channel without the user's signature.

---

## 7. Provider manifest

A provider manifest is a signed, versioned document. Minimum fields:

```ts
interface OmniaLspManifest {
  version: 'omnia-lsp/v1';
  providerId: string;
  identity: {
    address: string;
    publicKey?: string;
    proofRef?: string;
  };
  service: {
    type: 'omnia-lsp';
    name: string;
    version: string;
    relayUrl: string;
  };
  channel: {
    partyId: string;
    publicKeyDigest: string;
    settlementAddress: string;
    addressIndex?: number;
  };
  assets: Array<{
    tokenId: string;
    scale: number;
    inboundCapacity: string;
    outboundCapacity: string;
    minChannel: string;
    maxChannel: string;
  }>;
  fees: {
    openBps?: number;
    openFlat?: string;
    leaseBps?: number;
    routingBps?: number;
    swapSpreadBps?: number;
  };
  terms: {
    lease: boolean;
    jit: boolean;
    closePolicy: 'cooperative' | 'unilateral' | 'either';
    minLockBlocks?: number;
    maxLockBlocks?: number;
  };
  custody: {
    mode: 'self' | 'trust-minimised' | 'hosted';
    disclosureHash?: string;
    canMoveFunds: boolean;
  };
  bond?: {
    providerBondId: string;
    asset: string;
    amount: string;
    proofRef?: string;
  };
  publishedAt: number;
  expiresAt: number;
  sequence: number;
  topics: string[];
}
```

Requirements:

- The manifest MUST be signed by the provider identity.
- `channel.publicKeyDigest` MUST be bound to the identity via the RFC-037 ownership proof or an equivalent verified binding.
- `custody.canMoveFunds` MUST be `false` for a non-custodial Omnia LSP. A `true` value is a hosted service and MUST be gated by RFC-058 disclosure.
- Capacity MUST be an honest claim. A registry or client MUST treat it as a hint, not a reservation.
- The manifest MUST expire. Clients MUST reject stale manifests and stale quotes.
- Unknown fields MUST be ignored for forward compatibility; security-critical fields MUST fail closed if missing or invalid.

Manifest verification layers:

1. Verify the signed manifest (`@totemsdk/manifest`).
2. Verify the signer is authorised by the claimed identity (`@totemsdk/identity`).
3. Verify the provider-bond extension hash and score (`@totemsdk/provider-bond`).
4. Verify the channel identity binding and settlement address.
5. Verify freshness, sequence and topic scope.

---

## 8. Registry and discovery

### 8.1 Phase 1: curated registry

The first registry SHOULD be curated and transparent:

- a signed JSON/API list of launch providers;
- the same manifest schema;
- no pay-to-rank;
- published inclusion criteria and removal policy;
- an export path so the list can be self-hosted.

### 8.2 Phase 2: open announcements

After the direct path works, providers SHOULD publish signed announcements using RFC-071:

- `kind: 'provider'` or `kind: 'service'` with an Omnia LSP service type;
- topic derivation from asset, service and custody;
- expiry and sequence for freshness;
- no precise balances or topology in public announcements.

Transport is pluggable: `@totemsdk/pubsub-transport`, Hyperswarm topics, a lookup node, or a hosted registry API. The protocol MUST NOT require a single transport.

### 8.3 Ranking

Ranking MUST be deterministic and inspectable:

1. policy filter: asset, custody, minimum score, bond requirement, min/max, JIT/lease support;
2. provider score: `@totemsdk/provider-bond` identity 25%, bond 30%, reliability 30%, incidents 15%;
3. capacity fit: inbound/outbound for the requested asset and amount;
4. fee: open/lease/routing/swap spread;
5. route fit: whether the provider can reach the desired destination;
6. freshness and uptime.

Clients MUST show why a provider was selected and MUST allow the user to choose another provider. A registry MUST NOT silently rank by payment.

---

## 9. Open and lease protocol

### 9.1 Quote

The consumer requests a quote for:

- asset and amount;
- consumer address;
- desired inbound/outbound split;
- lease or direct channel;
- expiry window.

The provider returns a signed quote:

```ts
interface OmniaLspOpenQuote {
  version: 'omnia-lsp/v1';
  quoteId: string;
  providerId: string;
  consumerAddress: string;
  tokenId: string;
  localAmount: string;   // consumer side
  remoteAmount: string;  // provider side
  openFee: string;
  leaseFee?: string;
  providerPartyId: string;
  providerPublicKeyDigest: string;
  providerSettlementAddress: string;
  termsHash: string;
  expiresAt: number;
  signature: string;
}
```

The quote binds the exact provider channel identity, asset, amounts, fees, terms and expiry. A ticker is not an asset identity.

### 9.2 Funding

1. The consumer approves the quote and terms.
2. The wallet selects a funding coin from its own spendable coins (`utxo_read`).
3. The wallet builds the funding transaction and signs the funding witness.
4. The wallet shows the actual coin, amounts, provider, fees and channel terms for approval.
5. The consumer sends the open request, quote, channel proposal and signed funding witness to the provider.

The dApp or provider MUST NOT supply `fundingWitnessHex`. The wallet MUST build it from the selected coin. The provider MUST verify the coin, amount, token, script and witness before co-signing.

### 9.3 Co-sign and activate

1. The provider verifies the manifest, quote, identity, funding coin, amounts, fees and witness.
2. The provider co-signs the funding transaction.
3. The transaction is broadcast; the channel is active after confirmation.
4. Both parties persist the channel and the quote/terms hash.
5. The consumer sees the channel in Portfolio/Channels and can pay or swap.

### 9.4 Failure and timeout

- Quotes expire. Expired quotes MUST NOT be co-signed.
- If the provider is offline, the open aborts before funds move.
- If the consumer aborts, reserved WOTS indices MUST be released.
- If the provider aborts, the consumer's funding coin MUST remain unspent.
- Retries MUST be idempotent by `quoteId` and channel id.
- The protocol MUST define a bounded open timeout and a recovery path for a partially signed transaction.

### 9.5 Lease semantics

A lease is a channel where the provider funds a larger share of the capacity for a fee. The quote MUST state:

- which side funds which amount;
- the lease fee and payment timing;
- what happens on early close;
- whether the lease is renewable;
- the provider's recourse, if any.

A lease MUST remain a 2-of-2 channel. A lease MUST NOT become a custodial balance.

### 9.6 Lease source and funding proofs

Omnia defaults to a durable **local** WOTS lease store. Omnia signs arbitrary
channel state and funding digests, while the Axia hardened lease API is
transaction-shaped and quota-limited; local storage avoids that coupling and
keeps per-channel watermarks across restarts.

Axia hosted environments still need a CoinProof for the funding input. The
extension supports two paths:

1. `OMNIA_AXIA_LEASE=true`: use the Axia hardened lease adapter; the lease token
   authorises `/v1/wots-hardened/coinproofs`.
2. Local lease + a real project `x-api-key`: use `/v1/wallet/sdk/proofs`.

The shared `totem-shared` key is not a project credit key and cannot fetch funding
proofs. A hosted Axia open MUST fail closed with an actionable error when neither
path is configured. It MUST NOT silently fall back to a dApp-supplied witness.

---

## 10. Channel lifecycle

The provider and consumer MUST support:

- **monitor:** watch for state updates, pending HTLCs and counterparty liveness;
- **cooperative close:** both parties sign a final settlement;
- **unilateral exit:** a pre-signed or recoverable close path when the counterparty withholds;
- **watchtower:** optional monitoring and broadcast assistance;
- **splice/rebalance:** resize or rebalance a channel without closing it;
- **fee/lease accounting:** bind fees to the quote/terms hash.

Exit requirements:

- The consumer MUST be able to exit without the provider's live cooperation, using the agreed recoverable state and timelock.
- The provider MUST be able to exit without the consumer's live cooperation.
- A watchtower MUST NOT hold keys or be able to redirect funds.
- The UI MUST show the exit path and the timelock before the user signs.

---

## 11. Routing and swap liquidity

A channel that cannot route is not usable capacity.

- Providers SHOULD publish swap-rate and routing-capacity announcements (RFC-071).
- The wallet graph MUST receive those announcements; today it does not.
- Quotes MUST bind the rate, amount, asset, expiry and route.
- `getSwapRate` MUST NOT present an empty graph as a valid market.
- Cross-token swaps MUST follow RFC-055 and, where applicable, RFC-069.
- The current wallet relay client rejects first-hop cross-token swap hops; this RFC requires that limitation to be resolved or surfaced explicitly before swap execution is advertised.

---

## 12. JIT and submarine onboarding

Phase 3 adds the best consumer UX: the user has on-chain MIN and receives channel capacity atomically as part of the first payment or swap.

The JIT profile follows RFC-069:

- an on-chain conditional output and a channel HTLC share one hashlock;
- the maker/provider funds the channel leg;
- the taker/consumer funds the on-chain leg;
- either both legs complete or both refund;
- the quote binds asset, amount, fee, hash scheme, lock/refund heights and both parties.

JIT is out of scope for Phase 1. It MUST NOT be advertised until the direct open, close and refund paths are proven.

---

## 13. Security and threat model

| Threat | Mitigation |
|---|---|
| Malicious dApp supplies a funding witness for another coin | Wallet builds the witness; never accept it from a dApp |
| Funding-coin substitution | Wallet displays the coin; provider verifies coin id, amount, token and script |
| Provider impersonation | Signed manifest; identity binding; RFC-037 channel identity proof |
| Stale quote/manifest | Expiry, sequence, freshness checks; fail closed |
| Replay | `quoteId`, nonce, channel id, idempotent retries |
| Fee griefing | Quote binds fees; max fee; abort before signing |
| Provider offline during open | Bounded timeout; no funds move; release leases |
| Provider withholds close | Pre-signed unilateral exit; watchtower; timelock |
| Consumer withholds close | Provider unilateral exit; channel terms |
| Registry censorship or pay-to-rank | Multiple registries; transparent ranking; export |
| Relay metadata leakage | Pluggable transport; privacy guidance; no precise topology in public announcements |
| WOTS exhaustion | Lease accounting; rate limits; provider bond; capacity warnings |
| Bond overclaim | `provider-bond` v0.1 is data-only; on-chain collateral-bond covenant is separate |

The protocol MUST state that non-custodial does not mean trustless. Counterparty, liveness and privacy risks remain.

---

## 14. Privacy

- Public manifests SHOULD disclose capacity bands, not exact balances.
- Public announcements SHOULD NOT disclose precise counterparties or topology.
- Quotes and channel terms are private between consumer and provider.
- A registry SHOULD NOT require a consumer identity to read public manifests.
- Relay metadata SHOULD be minimised; self-hosted relay/sidecar MUST remain supported.

---

## 15. Package and repository plan

Canonical spec and code live in `totem-sdk`:

```text
totem-sdk/
  docs/rfc/RFC-081-OMNIA-LSP.md
  docs/omnia-lsp/
    README.md
    protocol.md
    manifest.schema.json
    registry.md
    jit.md
    threat-model.md
    conformance.md
  packages/omnia-lsp/
    src/            # manifests, ranking, quotes, client, state machines
  packages/omnia-lsp-provider/
    src/            # reference provider on omnia-host/router/splice
  tests/unit/omnia-lsp/
  tests/integration/omnia-lsp/
```

Axia hosts the first commercial provider from the published reference implementation:

```text
axia-platform/
  services/omnia-lsp-provider/
  docs/omnia-lsp-ops.md
  config/                        # commercial liquidity policy, not protocol
```

`Axia-Open-Finance` is not the home for this protocol; it is a separate open-finance product.

### 15.1 Package responsibilities

| Package | Responsibility |
|---|---|
| `@totemsdk/omnia-lsp` | Manifest schema, registry client interfaces, ranking, quotes, open/lease/JIT state machines; runtime-neutral |
| `@totemsdk/omnia-lsp-provider` | Reference provider/host: policy, open handler, close/watchtower, rebalance hooks, LP accounting integration |
| `@totemsdk/connect` | Fix `omniaOpenChannel`; provider quote types; wallet-built funding witness; approval payload |
| `@totemsdk/manifest` | Signed provider announcements and Omnia LSP service type |
| `@totemsdk/provider-bond` | Identity, bond claims, probes, incidents, deterministic score; LSP extension metadata |
| `@totemsdk/liquidity-bond` | LP commitments, positions, receipts, allocations, fee records, withdrawals |
| `@totemsdk/omnia-router` | Routing graph and swap announcements |
| `@totemsdk/omnia-splice` | Rebalance/resize channels |
| `@totemsdk/omnia-factory` | Provider-side factory tooling later; not first-run onboarding |
| `@totemsdk/omnia-host` | Provider host runtime and watchtower actions |
| MOKA | First consumer: one-click “Add spending capacity” |
| Axia | First hosted provider and commercial operations |

### 15.2 Licensing and governance

- Spec, SDK and reference provider: Apache-2.0, matching `totem-sdk`.
- Hosted operations, liquidity policy and capital strategy: commercial.
- Open RFC process; versioned `omnia-lsp/v1`; conformance suite; at least two independent provider implementations eventually.
- No pay-to-rank. Provider certification/trademark may be used to prevent misleading forks.

---

## 16. Implementation phases

### Phase 0 — Specification and conformance

- Accept this RFC.
- Publish `docs/omnia-lsp/` schema, protocol, threat model and conformance vectors.
- Define the `omnia-lsp/v1` manifest, quote and open/close messages.
- Acceptance: schema validates; test vectors cover happy path, stale quote, wrong witness, wrong coin, replay and abort.

### Phase 1 — Direct provider onboarding

- `@totemsdk/omnia-lsp` 0.1.0: types, manifest, ranking, client interfaces. *(Landed: manifest/quote validation, ranking and conformance vectors.)*
- Fix `@totemsdk/connect` `omniaOpenChannel`: wallet builds/signs the funding witness; provider quote accepted; approval payload shows coin, amounts, fees, provider and terms. *(Landed: connect contract and wallet `FundingWitnessBuilder` port; dApp witness rejected.)*
- `@totemsdk/omnia-lsp-provider` 0.1.0: reference provider with policy and open handler. *(Landed: admission policy, terms-bound quotes including consumer channel identity, and `createOmniaHostProviderHost` over `omnia-host` `createHostMethods`; channel execution is injected.)*
- MOKA: “Add spending capacity” against a launch provider.
- Axia: hosted launch provider with real liquidity.
- Two-party e2e: consumer extension + provider host; open → pay → close/refund.
- Acceptance: a new wallet with zero channels opens a 10 MIN channel, pays, closes and refunds; no dApp-supplied witness; timeout releases leases; no funds move on abort.
- Remaining before acceptance: live-Axia verification of the opt-in Axia lease + coinproof path (including the 10/day WOTS quota and `getCoin` behaviour), and the consumer extension wallet ↔ provider host e2e. The provider-funded host open → pay → settle → close path is proven on AWS A/B (2026-11-25). Default Omnia signing uses durable local lease storage.

### Phase 2 — Registry and multiple providers

- Signed provider announcements; curated registry then open registry.
- `provider-bond` scoring and policy filters.
- `liquidity-bond` LP commitments/positions/fee records.
- Swap/routing announcements wired into the wallet graph.
- Acceptance: at least three providers, deterministic ranking, failover to another provider, LP accounting reconciles, no pay-to-rank.

### Phase 3 — JIT/submarine onboarding

- Implement RFC-069 same-chain profile.
- On-chain → channel atomic open with refund and recovery.
- Acceptance: real-node recovery tests; on-chain leg refund; channel leg refund; restart recovery; no partial settlement.

### Phase 4 — Provider factories and operator tooling

- Provider-side factories/virtual channels for many users.
- Watchtower/SLA tooling; provider dashboards.
- Acceptance: provider manages multiple channels/factories; unilateral exits and watchtower actions pass; capital rebalancing works.

### Phase 5 — Open capacity marketplace

- Third-party providers, certification, audits, governance.
- Acceptance: external provider onboards without Totem/Axia intervention; ranking and disputes are transparent; security review complete.

---

## 17. Compatibility and versioning

- Protocol version: `omnia-lsp/v1`.
- Manifest, quote and message versions are independent but MUST negotiate.
- Unknown fields are ignored; security-critical fields fail closed.
- Deprecation requires a new version and a migration window.
- The protocol MUST remain compatible with self-hosted relay/sidecar and with the Axia hosted relay.
- `@totemsdk/connect` method changes follow the SDK compatibility policy; no consumer shims.

---

## 18. Open questions

1. **Registry transport:** curated API first, then manifest/Hyperswarm? Which is canonical for ranking?
2. **Bond enforcement:** when does the on-chain collateral-bond covenant become part of the LSP protocol? What is objectively slashable?
3. **Fee model:** open fee vs lease fee vs subscription; who pays the on-chain fee; how are refunds handled on early close?
4. **Lease semantics:** provider-funded side, recourse and regulatory treatment.
5. **Provider offline during open:** bounded abort only, or an asynchronous open protocol?
6. **JIT secret ownership:** who generates the preimage, and which party carries funding risk before both legs lock?
7. **Privacy:** how much capacity and counterparty data may a public manifest disclose?
8. **Multi-provider routing:** how are routes split across providers, and how is liquidity rebalanced?
9. **Factory role:** provider-side factories vs consumer onboarding; when is N-of-N acceptable?
10. **Certification:** what does “Totem Certified Omnia LSP” attest, and who can revoke it?

---

## 19. References

- RFC-002 — Omnia channel state machine
- RFC-014 — Wallet connect parity
- RFC-034 — Omnia relay method parity
- RFC-035 — Omnia peer coordination
- RFC-037 — Omnia channel identity
- RFC-048 — Omnia primitive completeness
- RFC-055 — Omnia routing architecture
- RFC-058 — Custody modes and disclosure gate
- RFC-059 — Discoverable liquidity
- RFC-064 — Off-chain principles
- RFC-069 — Same-chain submarine swaps
- RFC-071 — Announcement envelope and discovery consolidation
- `@totemsdk/provider-bond` — provider trust and scoring
- `@totemsdk/liquidity-bond` — LP position and fee accounting
