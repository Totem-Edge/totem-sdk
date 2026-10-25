[**@totemsdk/omnia-factory**](../index.md)

***

[@totemsdk/omnia-factory](../index.md) / signVirtualChannelOpen

# Function: signVirtualChannelOpen()

> **signVirtualChannelOpen**(`factory`, `plan`, `bundle`): `Promise`\<[`VirtualChannelOpenSignature`](../interfaces/VirtualChannelOpenSignature.md)\>

Produce this party's VC-open signature WITHOUT committing the lease
(RFC-035 B3). The caller commits on `VC_FINALIZED` or burns on expiry.

## Parameters

### factory

[`ChannelFactory`](../interfaces/ChannelFactory.md)

### plan

[`VirtualChannelOpenPlan`](../interfaces/VirtualChannelOpenPlan.md)

### bundle

[`WotsLeaseBundle`](../interfaces/WotsLeaseBundle.md)

## Returns

`Promise`\<[`VirtualChannelOpenSignature`](../interfaces/VirtualChannelOpenSignature.md)\>
