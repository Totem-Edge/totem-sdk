[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / prepareStateUpdate

# Function: prepareStateUpdate()

> **prepareStateUpdate**(`channel`, `update`, `leaseProvider`, `signer?`): `Promise`\<[`PreparedStateUpdate`](../interfaces/PreparedStateUpdate.md)\>

Build and reserve a channel update without signing it.

The caller owns the reservations: sign `updateDigest` and `settlementDigest`
with the reserved indices, then call `finalizeStateUpdate` and commit the
leases. On any failure before returning, the reservations are burned.

## Parameters

### channel

[`OmniaChannel`](../interfaces/OmniaChannel.md)

### update

#### newBalances

`Record`\<`string`, `bigint`\>

#### newSequence

`number`

#### programTransition?

[`ProgramTransition`](../interfaces/ProgramTransition.md)

### leaseProvider

`WotsLeaseProvider`

### signer?

[`ChannelSigner`](../interfaces/ChannelSigner.md)

## Returns

`Promise`\<[`PreparedStateUpdate`](../interfaces/PreparedStateUpdate.md)\>
