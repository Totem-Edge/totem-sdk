[**@totemsdk/omnia-factory**](../index.md)

***

[@totemsdk/omnia-factory](../index.md) / signFactorySettlement

# Function: signFactorySettlement()

> **signFactorySettlement**(`factory`, `draft`, `bundle`): `Promise`\<[`FactorySettlementSignature`](../interfaces/FactorySettlementSignature.md)\>

Produce this party's settlement signature WITHOUT committing the lease
(RFC-035 B3). The caller commits on `FACTORY_CLOSE_FINALIZED` or burns on expiry.

## Parameters

### factory

[`ChannelFactory`](../interfaces/ChannelFactory.md)

### draft

[`FactorySettlementDraft`](../interfaces/FactorySettlementDraft.md)

### bundle

[`WotsLeaseBundle`](../interfaces/WotsLeaseBundle.md)

## Returns

`Promise`\<[`FactorySettlementSignature`](../interfaces/FactorySettlementSignature.md)\>
