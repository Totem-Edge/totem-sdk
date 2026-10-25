[**@totemsdk/omnia-factory**](../index.md)

***

[@totemsdk/omnia-factory](../index.md) / closeFactory

# Function: closeFactory()

> **closeFactory**(`factory`, `leaseProviders`, `chainProvider?`, `opts?`): `Promise`\<[`FactorySettlementPayload`](../interfaces/FactorySettlementPayload.md)\>

Cooperative N-of-N factory close (central/local path).

Builds the settlement TX, collects all N signatures (each committing its own
lease via the full WOTS cycle), assembles the witness, and — when a
`chainProvider` is supplied — mines + broadcasts the settlement TxPoW.

## Parameters

### factory

[`ChannelFactory`](../interfaces/ChannelFactory.md)

Active factory with no open virtual channels.

### leaseProviders

`Record`\<`string`, [`WotsLeaseBundle`](../interfaces/WotsLeaseBundle.md)\>

WOTS lease bundles for ALL N factory participants.

### chainProvider?

`ChainStateProvider`

Optional: mine + broadcast the settlement TX.

### opts?

#### coinProof?

`Uint8Array`\<`ArrayBufferLike`\>

## Returns

`Promise`\<[`FactorySettlementPayload`](../interfaces/FactorySettlementPayload.md)\>
