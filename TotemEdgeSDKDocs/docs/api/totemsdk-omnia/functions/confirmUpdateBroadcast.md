[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / confirmUpdateBroadcast

# Function: confirmUpdateBroadcast()

> **confirmUpdateBroadcast**(`channel`, `opts`, `chainProvider`, `minConfirmations?`): `Promise`\<[`OmniaChannel`](../interfaces/OmniaChannel.md)\>

Record that the latest signed update is confirmed on chain.

Eltoo settlement spends the channel coin at its *on-chain* state, so
`onChainSequence` and `latestCoinId` must track the last confirmed update. They
are read from the coin itself — not from the off-chain sequence, and not from a
caller-supplied transaction — so a signed-but-unbroadcast state cannot move them.

The coin must be under the channel script address, have the requested
confirmation depth, and carry the sequence and port-102 commitment of
`latestState`.

## Parameters

### channel

[`OmniaChannel`](../interfaces/OmniaChannel.md)

### opts

[`ConfirmUpdateOptions`](../interfaces/ConfirmUpdateOptions.md)

### chainProvider

`ChainStateProvider`

### minConfirmations?

`number` = `1`

## Returns

`Promise`\<[`OmniaChannel`](../interfaces/OmniaChannel.md)\>
