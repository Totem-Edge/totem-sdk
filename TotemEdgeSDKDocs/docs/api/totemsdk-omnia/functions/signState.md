[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / signState

# Function: signState()

> **signState**(`channel`, `update`, `leaseProvider`, `signer?`, `signerPort?`): `Promise`\<`Partial`\<[`SignedChannelState`](../interfaces/SignedChannelState.md)\>\>

Signs a channel update state and returns the full partial `SignedChannelState`.

This is the local-signer path: prepare -> sign both digests -> commit -> finalize.
For a wallet/coordinator flow use `prepareStateUpdate` + `finalizeStateUpdate`.

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

### signerPort?

[`SignerPort`](../interfaces/SignerPort.md)

## Returns

`Promise`\<`Partial`\<[`SignedChannelState`](../interfaces/SignedChannelState.md)\>\>
