[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / buildStateUpdate

# Function: buildStateUpdate()

> **buildStateUpdate**(`channel`, `update`, `signer?`): [`UnsignedStateUpdate`](../interfaces/UnsignedStateUpdate.md)

Build a channel update without reserving a lease or signing.

Used by coordinator/wallet flows: the wallet reserves and signs, then returns
the signatures and indices to `finalizeStateUpdateWithIndices`.

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

### signer?

`Pick`\<[`ChannelSigner`](../interfaces/ChannelSigner.md), `"publicKeyDigest"`\>

## Returns

[`UnsignedStateUpdate`](../interfaces/UnsignedStateUpdate.md)
