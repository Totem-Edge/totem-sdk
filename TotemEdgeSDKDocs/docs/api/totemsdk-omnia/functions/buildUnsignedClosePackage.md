[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / buildUnsignedClosePackage

# Function: buildUnsignedClosePackage()

> **buildUnsignedClosePackage**(`channel`, `state`, `partyAddresses?`): [`SignedClosePackage`](../interfaces/SignedClosePackage.md)

## Parameters

### channel

[`OmniaChannel`](../interfaces/OmniaChannel.md)

### state

`Pick`\<[`SignedChannelState`](../interfaces/SignedChannelState.md), `"sequence"` \| `"balances"` \| `"pendingHTLCs"` \| `"stateVariables"` \| `"programTransition"`\>

### partyAddresses?

`Record`\<`string`, `string`\> = `...`

## Returns

[`SignedClosePackage`](../interfaces/SignedClosePackage.md)
