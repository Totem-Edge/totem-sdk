# @totemsdk/omnia-lsp

Omnia Liquidity Service Provider (Omnia LSP) protocol primitives: signed provider
manifests, capacity quotes and deterministic provider ranking.

> **Status:** 0.1.0 — draft protocol surface. See RFC-080 in
> `docs/rfc/RFC-080-OMNIA-LSP.md`.

This package is runtime-neutral and holds no keys, funds or network clients. It
answers:

- Is this provider manifest structurally valid and fresh?
- Does a quote match the provider manifest it claims to represent?
- Which providers satisfy a capacity request under a policy?

It does **not** verify manifest signatures, open channels or move funds. Signature
verification, identity binding and channel execution belong to
`@totemsdk/manifest`, `@totemsdk/identity`, `@totemsdk/omnia` and the provider
runtime.

## Install

```bash
pnpm add @totemsdk/omnia-lsp
```

## Manifest

```ts
import { assertValidManifest, type OmniaLspManifest } from '@totemsdk/omnia-lsp';

const manifest: OmniaLspManifest = {
  version: 'omnia-lsp/v1',
  providerId: 'prov-moka-1',
  identity: { address: 'Mx…' },
  service: {
    type: 'omnia-lsp',
    name: 'MOKA Launch Provider',
    version: '1.0.0',
    relayUrl: 'wss://api.axia.to/api/relay/ws',
  },
  channel: {
    partyId: 'party-…',
    publicKeyDigest: '0x…',
    settlementAddress: 'Mx…',
  },
  assets: [{
    tokenId: '0x00',
    scale: 44,
    inboundCapacity: '1000',
    outboundCapacity: '1000',
    minChannel: '10',
    maxChannel: '500',
  }],
  fees: { openBps: 0, routingBps: 10 },
  terms: { lease: false, jit: false, closePolicy: 'either' },
  custody: { mode: 'self', canMoveFunds: false },
  publishedAt: Date.now(),
  expiresAt: Date.now() + 60_000,
  sequence: 1,
};

assertValidManifest(manifest);
```

## Ranking

```ts
import { rankProviders } from '@totemsdk/omnia-lsp';

const ranked = rankProviders(candidates, {
  tokenId: '0x00',
  amount: '100',
  direction: 'both',
  maxOpenFeeBps: 50,
});
```

Ranking is a policy filter plus a stable sort. It treats capacity as a hint, not a
reservation. Callers MUST verify the manifest signature and identity binding
before ranking.

## Test vectors

`test-vectors/` contains canonical valid and invalid manifest/quote fixtures for
conformance testing. See RFC-080 Phase 0.

## License

Apache-2.0. See `LICENSE` and `NOTICE`.
