[**@totemsdk/omnia-factory**](../index.md)

***

[@totemsdk/omnia-factory](../index.md) / createFactory

# Function: createFactory()

> **createFactory**(`participants`, `tokenId`, `bundle`, `chainProvider?`): `Promise`\<[`ChannelFactory`](../interfaces/ChannelFactory.md)\>

Create a factory proposal (proposer step).

The calling party (`signer.publicKeyDigest` matches one of `participants`)
signs the factory opening commitment via `leaseProvider`, performing the full
WOTS reserve → sign → verify → commit cycle.

When ALL participants supply `fundingCoinId` and `chainProvider` is given,
the N-input → 1-output funding TX is built (via `@totemsdk/omnia`'s
`buildFundingTx`), mined (via `@totemsdk/txpow`'s `mineTxPoW`), and broadcast.
The TX draft digest is used as the factory opening commitment so that all
parties are co-signing the EXACT on-chain TX structure.

Without `fundingCoinId`s or `chainProvider`, the factory is in-memory only
(useful for testing and off-chain simulation); the commitment falls back to
the factory state commitment hash.

The returned factory is in `'opening'` status.  Every other participant must
call `acceptFactory(factory, leaseProvider, signer)` before the factory
transitions to `'active'`.

## Parameters

### participants

[`FactoryParticipant`](../interfaces/FactoryParticipant.md)[]

All N factory participants with their contribution amounts.

### tokenId

`string`

Token ID (e.g. `'0x00'` for native Minima).

### bundle

[`WotsLeaseBundle`](../interfaces/WotsLeaseBundle.md)

### chainProvider?

`ChainStateProvider`

Optional: build + mine + broadcast the factory funding TX.

## Returns

`Promise`\<[`ChannelFactory`](../interfaces/ChannelFactory.md)\>
