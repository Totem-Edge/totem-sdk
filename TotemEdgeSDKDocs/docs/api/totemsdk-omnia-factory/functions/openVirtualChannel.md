[**@totemsdk/omnia-factory**](../index.md)

***

[@totemsdk/omnia-factory](../index.md) / openVirtualChannel

# Function: openVirtualChannel()

> **openVirtualChannel**(`factory`, `parties`, `amounts`, `leaseProviders`, `channelId?`): `Promise`\<\{ `channel`: [`OmniaChannel`](../interfaces/OmniaChannel.md); `factory`: [`ChannelFactory`](../interfaces/ChannelFactory.md); \}\>

Open a virtual channel between two factory participants.

ALL N factory participants must agree (N-of-N WOTS signature collection)
before the virtual channel is committed and allocations deducted. This ensures
the shared factory UTXO's off-chain state is consistent and dispute-provable.

The commitment is bound to `currentSequence + 1` — the post-commit sequence —
preventing replay of the same openVC commitment against a future factory state.

The returned `OmniaChannel` has `channelType: 'virtual'` and `factoryRef` set.
Its `fundingTxId`/`fundingCoinId` reference the factory's shared UTXO.
It is ready for off-chain state updates via `@totemsdk/omnia` primitives
(`updateState`, `addHTLC`, `signState`, etc.).

## Parameters

### factory

[`ChannelFactory`](../interfaces/ChannelFactory.md)

Active factory.

### parties

\[`string`, `string`\]

Tuple `[partyAId, partyBId]` of the two channel parties.

### amounts

`Record`\<`string`, `bigint`\>

Capacity per party: `Record<partyId, bigint>`.

### leaseProviders

`Record`\<`string`, [`WotsLeaseBundle`](../interfaces/WotsLeaseBundle.md)\>

WOTS lease bundles for ALL N factory participants.

### channelId?

`string`

Optional explicit channel ID; auto-generated if omitted.

## Returns

`Promise`\<\{ `channel`: [`OmniaChannel`](../interfaces/OmniaChannel.md); `factory`: [`ChannelFactory`](../interfaces/ChannelFactory.md); \}\>
