# Omnia LSP — registry and ranking

**Status:** Draft. Phase 1 uses a curated registry; Phase 2 adds signed open
announcements. Ranking is deterministic and inspectable. No pay-to-rank.

**Canonical RFC:** [RFC-081](../rfc/RFC-081-OMNIA-LSP.md) §8.

## 1. Phase 1 — curated registry

The launch registry is a signed JSON document served by the wallet vendor or a
community operator:

```json
{
  "version": "omnia-lsp/registry/v1",
  "sequence": 42,
  "publishedAt": 1790000000000,
  "expiresAt": 1790086400000,
  "providers": [
    {
      "manifest": { "version": "omnia-lsp/v1", "...": "..." },
      "manifestSignature": "0x…",
      "topics": ["omnia", "minima", "eu"]
    }
  ],
  "signature": "0x…"
}
```

Requirements:

- The registry document is signed and expiring.
- Every entry carries a complete signed provider manifest.
- The registry does not replace manifest verification; the client verifies the
  manifest, identity binding and channel keys itself.
- Inclusion criteria and removal policy are published.
- The list is exportable and self-hostable; a client MUST be able to use a
  pinned manifest without the registry.
- No payment changes position or score.

## 2. Phase 2 — open announcements

After direct open/pay/close works end to end, providers publish signed
announcements using RFC-071:

- `kind: 'provider'` or `kind: 'service'` with an Omnia LSP service type;
- topic derivation from asset, service and custody;
- `sequence` and `expiresAt` for freshness;
- capacity bands, not exact balances or topology.

Transport is pluggable: Hyperswarm topics, a lookup node, `@totemsdk/pubsub-transport`
or a hosted registry API. The protocol does not require a single transport.

## 3. Verification pipeline

Before a manifest is eligible for ranking:

1. **Signature** — `@totemsdk/manifest` verifies the signed manifest.
2. **Identity** — `@totemsdk/identity` verifies the signer is authorised by the
   claimed identity.
3. **Channel binding** — `channel.publicKeyDigest` is bound to the identity by
   an RFC-037 ownership proof or equivalent; the settlement address is valid.
4. **Custody** — `custody.canMoveFunds` MUST be `false` for a non-custodial
   provider. A hosted provider with `true` is gated by RFC-058 disclosure.
5. **Freshness** — manifest `expiresAt` is in the future and `sequence` is not
   older than the last seen sequence for that provider.
6. **Policy** — asset, min/max channel, lease/JIT support, bond/score floor.

A manifest that fails any step is not ranked. It is not "ranked last".

## 4. Ranking

`rankProviders` in `@totemsdk/omnia-lsp` implements the deterministic Phase 1
ranking. Filters run first, then scoring, then a stable tie-break.

### 4.1 Filters

- requested `tokenId` is offered and the amount fits `minChannel..maxChannel`;
- custody mode is allowed by the client policy;
- lease/JIT support matches the request;
- provider score meets the client's minimum;
- bond requirement is met, if the client requires one;
- route/destination fit, when routing information is available;
- manifest and quote freshness.

### 4.2 Score

The provider-bond score is composed of:

| Component | Weight |
|---|---|
| identity | 25% |
| bond | 30% |
| reliability | 30% |
| incidents | 15% |

The rankable components add:

- **capacity fit** — inbound/outbound capacity for the requested asset/amount;
- **fee** — open, lease, routing and swap-spread fees from the quote;
- **route fit** — whether the provider can reach the destination;
- **freshness/uptime** — recent manifest and health signals.

The exact weights are policy inputs, not protocol constants. A client MUST be
able to change them and MUST show the inputs used.

### 4.3 Tie-break and explanation

Ties are broken deterministically (for example by provider id, then manifest
sequence) so two clients with the same policy see the same order. The client
MUST expose:

- why a provider was selected;
- the filters and scores applied;
- at least one alternative provider when available;
- a manual override.

A registry or hosted API MUST NOT silently reorder by payment, affiliate fee or
private deal.

## 5. Failover

If the selected provider fails before funds move, the client may try the next
ranked provider with the same request. The open is idempotent by `quoteId` and
channel id. If funds have moved, failover MUST NOT open a second channel; the
client resolves or closes the existing one first.

## 6. Capacity is a hint

Published inbound/outbound capacity is an honest claim, not a reservation. The
provider re-checks real capacity, funding coins, lease quota and channel state
before co-signing. A client MUST treat a stale or over-claimed capacity figure
as a failed quote, not as a promise.

## 7. Privacy

- Public manifests disclose capacity bands, not exact balances.
- Public announcements do not disclose counterparties or topology.
- Quotes and channel terms are private between consumer and provider.
- Reading a public manifest does not require a consumer identity.
- Relay metadata is minimized; self-hosted relay/sidecar remains supported.
