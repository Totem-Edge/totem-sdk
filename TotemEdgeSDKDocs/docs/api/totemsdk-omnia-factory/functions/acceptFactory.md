[**@totemsdk/omnia-factory**](../index.md)

***

[@totemsdk/omnia-factory](../index.md) / acceptFactory

# Function: acceptFactory()

> **acceptFactory**(`factory`, `bundle`): `Promise`\<[`ChannelFactory`](../interfaces/ChannelFactory.md)\>

Counterparty co-signs the factory proposal.

Each non-proposing participant calls this once. When ALL N parties have
signed (proposer via `createFactory` + N-1 counterparties via `acceptFactory`),
the factory transitions from `'opening'` to `'active'`.

Uses the full WOTS lease cycle: reserve → sign → verify → commit.

## Parameters

### factory

[`ChannelFactory`](../interfaces/ChannelFactory.md)

Factory in `'opening'` status returned by `createFactory`.

### bundle

[`WotsLeaseBundle`](../interfaces/WotsLeaseBundle.md)

## Returns

`Promise`\<[`ChannelFactory`](../interfaces/ChannelFactory.md)\>
