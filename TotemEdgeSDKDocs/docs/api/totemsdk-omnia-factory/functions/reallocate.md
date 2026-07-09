[**@totemsdk/omnia-factory**](../index.md)

***

[@totemsdk/omnia-factory](../index.md) / reallocate

# Function: reallocate()

> **reallocate**(`factory`, `fromPartyId`, `toPartyId`, `amount`, `leaseProviders`): `Promise`\<[`ChannelFactory`](../interfaces/ChannelFactory.md)\>

Move factory allocation between two participants (atomic N-of-N).

All N leaseProviders must be supplied; each party signs the new state
commitment in turn.  The state commits atomically — no intermediate "pending"
object is returned.

## Parameters

### factory

[`ChannelFactory`](../interfaces/ChannelFactory.md)

Active factory.

### fromPartyId

`string`

Party giving up allocation.

### toPartyId

`string`

Party receiving allocation.

### amount

`bigint`

Amount to transfer (must be positive and within `fromPartyId`'s balance).

### leaseProviders

`Record`\<`string`, [`WotsLeaseBundle`](../interfaces/WotsLeaseBundle.md)\>

WOTS lease bundles for ALL N factory participants.

## Returns

`Promise`\<[`ChannelFactory`](../interfaces/ChannelFactory.md)\>
