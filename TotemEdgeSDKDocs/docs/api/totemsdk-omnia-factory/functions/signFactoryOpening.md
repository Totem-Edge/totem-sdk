[**@totemsdk/omnia-factory**](../index.md)

***

[@totemsdk/omnia-factory](../index.md) / signFactoryOpening

# Function: signFactoryOpening()

> **signFactoryOpening**(`factory`, `bundle`): `Promise`\<[`FactoryOpeningSignature`](../interfaces/FactoryOpeningSignature.md)\>

Produce this party's opening signature WITHOUT committing the lease
(RFC-035 B2). The caller commits on `FACTORY_FINALIZED` or burns on expiry —
mirroring the splice accept round so a peer can gather N-of-N signatures
without stranding or prematurely committing one-time keys.

## Parameters

### factory

[`ChannelFactory`](../interfaces/ChannelFactory.md)

### bundle

[`WotsLeaseBundle`](../interfaces/WotsLeaseBundle.md)

## Returns

`Promise`\<[`FactoryOpeningSignature`](../interfaces/FactoryOpeningSignature.md)\>
