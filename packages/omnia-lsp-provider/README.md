# @totemsdk/omnia-lsp-provider

Reference Omnia Liquidity Service Provider (Omnia LSP) facade: provider policy,
signed capacity quotes and a host adapter.

> **Status:** 0.1.0 — draft reference surface. See RFC-080 in
> `docs/rfc/RFC-080-OMNIA-LSP.md`.

This package does **not** hold keys, open channels or broadcast. It:

- evaluates an open request against a provider manifest;
- issues a provider-signed quote with a bound terms hash;
- delegates the channel operation to an injected host port.

The host port is where a real provider wires `@totemsdk/omnia-host` (or its own
channel runtime), channel proofs, WOTS leases and broadcast.

## Usage

```ts
import { createOmniaLspProvider } from '@totemsdk/omnia-lsp-provider';

const provider = createOmniaLspProvider({
  manifest,
  signQuote: (quote) => signWithProviderIdentity(quote),
  host: {
    async openChannel({ quote, fundingCoinId }) {
      return openChannelWithOmniaHost({ quote, fundingCoinId });
    },
    async closeChannel(channelId) {
      return closeChannelWithOmniaHost(channelId);
    },
  },
});

const decision = provider.evaluate({
  providerId: manifest.providerId,
  consumerAddress: 'Mx…',
  tokenId: '0x00',
  localAmount: '100',
  remoteAmount: '100',
  direction: 'both',
});
```

## omnia-host adapter

`createOmniaHostProviderHost` adapts an `omnia-host` method registry:

```ts
import { createHostMethods } from '@totemsdk/omnia-host';
import { createOmniaHostProviderHost } from '@totemsdk/omnia-lsp-provider';

const host = createOmniaHostProviderHost({
  methods: createHostMethods(hostContext),
});
```

It maps the consumer-side quote into the provider's `totem_omniaOpenChannel`
call, swapping the channel sides (provider side becomes host-local, consumer
side becomes host-remote), and delegates `totem_omniaCloseChannel`.

Funding material is optional. Pass `fundingCoinId` plus the node proof fields
when the provider already selected a coin. Omit them to let `omnia-host`
select a sendable coin and build the funding witness from its own wallet/node:

```ts
await provider.open(request); // host selects the provider funding coin
await provider.open(request, { fundingCoinId: '0x…', fundingPubkey: '0x…', fundingScript: 'RETURN …' });
```

`contestDelayBlocks` is optional. Omit it for the host/program default (normally
the 256-block mainnet floor); test/dev hosts may pass a shorter value when
`OMNIA_ALLOW_SHORT_CONTEST_DELAY=1`.

## Security notes

- Quotes are not authoritative until signed.
- `evaluateOpenRequest` is admission policy, not a capacity reservation.
- The host MUST re-check the funding coin, channel state, capacity and quote
  freshness before co-signing.
- A dApp or provider MUST NOT supply the consumer's funding witness.

## License

Apache-2.0. See `LICENSE` and `NOTICE`.
