# Omnia LSP — protocol profile

**Status:** Draft (`omnia-lsp/v1`, quote `omnia-lsp/open-quote/v1`). This document
describes the Phase 1 direct-open profile implemented by
`@totemsdk/omnia-lsp` and `@totemsdk/omnia-lsp-provider`. Registry discovery and
JIT are separate profiles.

**Canonical RFC:** [RFC-081](../rfc/RFC-081-OMNIA-LSP.md) §7–§10.

## 1. Roles

| Role | Holds keys | Builds funding witness | Co-signs channel |
|---|---|---|---|
| Consumer wallet | yes | **yes** | yes |
| Provider | yes | no | yes |
| dApp / merchant / agent | no (delegates to wallet) | **no** | no |
| Registry | no | no | no |

The consumer wallet is the only party that may build `fundingWitnessHex`. A
dApp, merchant, registry or provider MUST NOT supply it. `@totemsdk/connect`
rejects it on the dApp-facing open call.

## 2. Versions

- Manifest: `omnia-lsp/v1`.
- Open quote: `omnia-lsp/open-quote/v1`.
- Unknown fields are ignored. Missing or invalid security-critical fields fail
  closed.

## 3. Direct-open flow

```text
consumer wallet                 provider
      |                            |
      | 1. fetch/verify manifest   |
      |--------------------------->|
      | 2. quote request           |
      |--------------------------->|
      | 3. signed quote            |
      |<---------------------------|
      | 4. verify quote + terms    |
      | 5. select funding coin     |
      | 6. build + sign witness    |
      | 7. open request + witness  |
      |--------------------------->|
      | 8. verify coin/witness     |
      | 9. co-sign + broadcast     |
      |<---------------------------|
      | 10. active after confirm   |
      |                            |
      | 11. pay / swap             |
      | 12. cooperative close      |
      |<-------------------------->|
```

### 3.1 Manifest

The provider publishes a signed, expiring `omnia-lsp/v1` manifest. The consumer
verifies, in order:

1. the manifest signature (`@totemsdk/manifest`);
2. the signer is authorised by `identity` (`@totemsdk/identity`);
3. the channel identity binding and settlement address;
4. freshness (`expiresAt`, `sequence`);
5. the requested asset, capacity and custody mode.

`validateManifest` in `@totemsdk/omnia-lsp` performs the structural and
freshness checks. Signature/identity verification is layered on top by the
caller.

### 3.2 Quote request

The consumer asks for a quote with:

- `providerId`, `tokenId`;
- `consumerAddress`, `consumerPartyId`, `consumerPublicKeyDigest`;
- optional `consumerSettlementAddress`, `consumerTransportPubkey`;
- desired `localAmount` (consumer side) and `remoteAmount` (provider side);
- direct channel or lease;
- expiry window.

The transport for the request is not fixed by the protocol. Phase 1 uses the
provider's HTTP/JSON control plane or relay; a signed response is what matters.

### 3.3 Signed quote

The provider returns an `OmniaLspOpenQuote`:

| Field | Meaning |
|---|---|
| `version` | `omnia-lsp/open-quote/v1` |
| `quoteId` | idempotency key |
| `providerId` | manifest provider |
| `consumerAddress` | consumer wallet address |
| `consumerPartyId` | consumer Omnia party id |
| `consumerPublicKeyDigest` | consumer channel key digest |
| `consumerSettlementAddress` | optional consumer settlement output |
| `consumerTransportPubkey` | optional authenticated transport binding |
| `tokenId` | asset identity (`0x00` or 32-byte token id) |
| `localAmount` | consumer initial balance |
| `remoteAmount` | provider initial balance |
| `openFee` | fee in the same asset |
| `leaseFee` | optional lease fee |
| `providerPartyId` | provider channel party id |
| `providerPublicKeyDigest` | provider channel key digest |
| `providerSettlementAddress` | provider settlement output |
| `termsHash` | hash of the accepted terms |
| `expiresAt` | future unix epoch ms |
| `signature` | provider signature |

The consumer verifies:

- `validateOpenQuote`;
- `quoteIsFresh`;
- `quoteMatchesManifest`;
- the provider signature over the canonical quote payload;
- the exact consumer identity, amounts, fees, token and terms.

A ticker is not an asset identity. A quote that does not match the manifest's
channel identity is rejected.

### 3.4 Funding witness

1. The wallet selects a spendable coin (`utxo_read`).
2. The wallet builds the funding transaction and signs the witness.
3. The approval UI shows the actual coin id, amounts, provider, fee and channel
   terms.
4. The wallet sends the open request, quote, channel proposal and witness.

Provider-side checks before co-signing:

- quote is fresh and matches the manifest;
- funding coin exists, is unspent, has the expected token and amount;
- the channel script/address matches the agreed parties and delay;
- the witness verifies for that coin and script;
- the consumer identity and transport match the quote.

### 3.5 Co-sign, activate, close

- The provider co-signs the funding transaction; either party may broadcast
  according to the implementation.
- The channel becomes active after the agreed confirmation depth.
- Both parties persist the channel, quote id, terms hash and funding proof.
- Cooperative close signs a final settlement. Unilateral exit uses the
  pre-signed/recoverable state and the agreed timelock.
- Fees are bound to `termsHash`; a provider cannot silently change them after
  the quote.

## 4. Provider host mapping

`createOmniaHostProviderHost` adapts an `omnia-host` method registry. The quote
is written from the consumer's perspective, so the provider host swaps sides:

| Quote | `totem_omniaOpenChannel` |
|---|---|
| `consumerPartyId` | `remotePartyId` |
| `consumerPublicKeyDigest` | `remotePublicKeyDigest` |
| `consumerSettlementAddress` | `remoteSettlementAddress` |
| `consumerTransportPubkey` | `remoteTransportPubkey` |
| `remoteAmount` (provider side) | `localAmount` |
| `localAmount` (consumer side) | `remoteAmount` |

The host adapter delegates `closeChannel` to `totem_omniaCloseChannel`. It does
not hold keys or broadcast itself; the `omnia-host` context supplies the signer,
lease provider and chain provider.

Funding is a provider-host decision:

- pass `fundingCoinId` and the node proof fields (`fundingPubkey`,
  `fundingScript`, `fundingCoinProofsHex`) when the provider already selected a
  coin;
- omit them to let `omnia-host` select a sendable provider coin and build the
  funding witness from its own wallet/node;
- a provider wallet may pass `fundingWitnessHex` because the provider is the
  funding party. The consumer/dApp witness restriction still applies to the
  consumer side.

`contestDelayBlocks` is an optional open parameter. Omit it for the host/program
default (normally 256); test/dev hosts may use a shorter value when
`OMNIA_ALLOW_SHORT_CONTEST_DELAY=1`. Mainnet providers must not shorten it
silently.

## 5. Failure and timeout

| Condition | Required behaviour |
|---|---|
| Quote expired | reject; do not co-sign |
| Manifest stale | reject; re-discover |
| Provider offline before funding | abort; no funds move |
| Consumer aborts | release reserved WOTS indices |
| Provider aborts | funding coin remains unspent |
| Duplicate open | idempotent by `quoteId` / channel id |
| Partially signed transaction | bounded recovery; never leave funds in an unowned output |
| Funding confirmation slow | channel remains `opening`/`funding_pending`; no value moves until active |

A channel is not usable until both sides agree it is active. The SDK promotes
`opening` and `funding_pending` on read once the funding coin reaches the
required depth.

## 6. Lease profile

A lease is still a 2-of-2 channel; the provider funds a larger share for a fee.
The quote MUST state:

- which side funds which amount;
- lease fee and timing;
- early-close treatment;
- renewal;
- provider recourse, if any.

Omnia defaults to a durable local WOTS lease store. Hosted Axia environments
may opt into the Axia hardened lease with `OMNIA_AXIA_LEASE=true`; a hosted open
MUST fail closed if neither the hardened lease nor a real project API key is
configured. A dApp-supplied witness is never an acceptable fallback.

## 7. Not in this profile

- Open registry and third-party announcements (Phase 2).
- JIT/submarine atomic onboarding (Phase 3; see `jit.md`).
- Provider factories and watchtower tooling (Phase 4).
- Open capacity marketplace (Phase 5).
