[**@totemsdk/omnia-factory**](../index.md)

***

[@totemsdk/omnia-factory](../index.md) / closeVirtualChannel

# Function: closeVirtualChannel()

> **closeVirtualChannel**(`factory`, `channel`, `leaseProviders`): `Promise`\<[`ChannelFactory`](../interfaces/ChannelFactory.md)\>

Close a virtual channel and return its final balances to factory allocations.

ALL N factory participants must agree (N-of-N WOTS signature collection).
The commitment is bound to `currentSequence + 1`.

Final balances are taken from `channel.latestState.balances` (the last agreed
off-chain state from `@totemsdk/omnia`'s state machine) or fall back to
`channel.balances` (the initial opening split) if no state updates have occurred.

No on-chain TX is needed: the factory's shared UTXO remains intact.

## Parameters

### factory

[`ChannelFactory`](../interfaces/ChannelFactory.md)

Active factory.

### channel

[`OmniaChannel`](../interfaces/OmniaChannel.md)

The virtual `OmniaChannel` to close (with `latestState` set if updated).

### leaseProviders

`Record`\<`string`, [`WotsLeaseBundle`](../interfaces/WotsLeaseBundle.md)\>

WOTS lease bundles for ALL N factory participants.

## Returns

`Promise`\<[`ChannelFactory`](../interfaces/ChannelFactory.md)\>
