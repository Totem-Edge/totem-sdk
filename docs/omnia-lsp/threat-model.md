# Omnia LSP — threat model

**Status:** Draft. This expands RFC-081 §13–§14. Non-custodial does not mean
trustless: counterparty, liveness and privacy risks remain.

**Canonical RFC:** [RFC-081](../rfc/RFC-081-OMNIA-LSP.md) §13.

## 1. Trust boundaries

| Boundary | What crosses it |
|---|---|
| dApp / merchant → wallet | order intent, amount, provider choice; **never a funding witness** |
| wallet → provider | signed quote acceptance, channel proposal, wallet-built witness |
| provider → registry | signed manifest and announcements |
| registry → client | signed manifest list; never trusted as capacity truth |
| provider ↔ chain | funding tx, co-signature, settlement/close |
| hosted Axia API | lease/coinproof requests; project API key or hardened lease token |

The wallet is the only party that chooses and signs the funding input. The
provider is the only party that chooses and signs its own channel side. The
registry is a discovery aid, not an authority.

## 2. Threats and mitigations

| # | Threat | Mitigation | Phase 1 status |
|---|---|---|---|
| T1 | Malicious dApp supplies a witness for another coin | Wallet builds/signs the witness; `@totemsdk/connect` rejects dApp `fundingWitnessHex` | Implemented |
| T2 | Funding-coin substitution | Wallet displays coin id/amount/token; provider re-checks coin, script and witness | Implemented at host boundary |
| T3 | Provider impersonation | Signed manifest; identity binding; channel key proof | Manifest/identity layers defined; signature verification caller-supplied |
| T4 | Stale quote or manifest | `expiresAt`, `sequence`, freshness checks; fail closed | Implemented in validators |
| T5 | Quote substitution | Quote binds provider, consumer identity, asset, amounts, fees, terms hash, expiry | Implemented |
| T6 | Replay / duplicate open | `quoteId`, channel id, idempotent retries | Defined; host operation ids include quote id |
| T7 | Fee griefing | Quote binds fees; wallet shows them; abort before signing | Implemented in quote/approval surface |
| T8 | Provider offline before funding | Bounded timeout; no funds move; release WOTS reservations | Defined; lease release tested |
| T9 | Provider withholds close | Pre-signed/recoverable unilateral exit; contest delay; watchtower | Channel layer; LSP UI must show exit path |
| T10 | Consumer withholds close | Provider unilateral exit under the same channel terms | Channel layer |
| T11 | Capacity overclaim | Capacity is a hint; provider re-checks real capacity/coins/lease quota | Implemented as policy re-check |
| T12 | Registry censorship or pay-to-rank | Multiple registries; signed export; deterministic ranking; manual override | Policy defined |
| T13 | Relay metadata leakage | Pluggable transport; no precise topology in public data; self-hosted relay | Relay work separate |
| T14 | WOTS exhaustion | Lease accounting; provider quota; capacity warnings; bound key use | Local/Axia lease adapters |
| T15 | Bond overclaim | Provider-bond score is data-only until an on-chain bond covenant exists | Out of Phase 1 |
| T16 | Hosted API key leakage | Project-scoped key; no shared `totem-shared` credit key for proofs; fail closed | Extension path implemented |
| T17 | Stale balance/index | Balance freshness checks; node health; MMR snapshot age guard | Axia ops guard; see `docs/deployment/12-megammr-node-provisioning.md` |
| T18 | Provider returns a signed quote for a different consumer | Quote binds `consumerAddress`, `consumerPartyId`, `consumerPublicKeyDigest` | Implemented |
| T19 | Provider swaps the channel sides | Provider host adapter swaps quote sides explicitly; tests pin the mapping | Implemented |
| T20 | Partially signed funding tx | Bounded open timeout; recovery; never leave an unowned output | Channel-layer recovery; e2e pending |

## 3. Invariants

1. The consumer's funding coin is selected by the wallet, not by the provider
   or dApp.
2. The provider cannot move the consumer's funds without the consumer's
   co-signature.
3. A quote is not authority to open; the provider re-checks terms, coin,
   capacity and freshness.
4. A channel is not active until funding confirms and both sides agree.
5. A lease remains a 2-of-2 channel; it never becomes a custodial balance.
6. Expired quotes and stale manifests fail closed.
7. Abort before broadcast leaves the funding coin unspent and releases reserved
   WOTS indices.
8. A hosted open either uses a hardened lease or a real project API key; there
   is no silent fallback to a dApp witness.

## 4. Residual risks

- **Counterparty liveness** — a provider can go offline mid-channel; the
  unilateral exit and contest delay are the backstop.
- **Hosted provider discretion** — a hosted provider can refuse service; the
  protocol does not guarantee inclusion.
- **Relay privacy** — a relay sees metadata even when it cannot read content.
- **Registry trust** — a curated registry can omit providers; clients can pin
  manifests or use another registry.
- **Bond data** — a score without an enforceable bond is a reputation signal,
  not collateral.
- **Index freshness** — a node can answer health checks while serving a stale
  balance index; operators must monitor snapshot/index age, not just chain tip.
