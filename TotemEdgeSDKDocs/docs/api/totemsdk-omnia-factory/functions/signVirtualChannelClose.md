[**@totemsdk/omnia-factory**](../index.md)

***

[@totemsdk/omnia-factory](../index.md) / signVirtualChannelClose

# Function: signVirtualChannelClose()

> **signVirtualChannelClose**(`factory`, `plan`, `bundle`): `Promise`\<[`VirtualChannelOpenSignature`](../interfaces/VirtualChannelOpenSignature.md)\>

Produce this party's VC-close signature without committing the lease.

## Parameters

### factory

[`ChannelFactory`](../interfaces/ChannelFactory.md)

### plan

[`VirtualChannelClosePlan`](../interfaces/VirtualChannelClosePlan.md)

### bundle

[`WotsLeaseBundle`](../interfaces/WotsLeaseBundle.md)

## Returns

`Promise`\<[`VirtualChannelOpenSignature`](../interfaces/VirtualChannelOpenSignature.md)\>
