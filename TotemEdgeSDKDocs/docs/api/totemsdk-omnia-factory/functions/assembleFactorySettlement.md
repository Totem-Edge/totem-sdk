[**@totemsdk/omnia-factory**](../index.md)

***

[@totemsdk/omnia-factory](../index.md) / assembleFactorySettlement

# Function: assembleFactorySettlement()

> **assembleFactorySettlement**(`factory`, `draft`, `signatures`, `chainProvider?`, `options?`): `Promise`\<[`FactorySettlementPayload`](../interfaces/FactorySettlementPayload.md)\>

Assemble N-of-N settlement signatures into the MULTISIG witness + payload, and
(when a `chainProvider` is given) mine + broadcast the settlement TxPoW.

## Parameters

### factory

[`ChannelFactory`](../interfaces/ChannelFactory.md)

### draft

[`FactorySettlementDraft`](../interfaces/FactorySettlementDraft.md)

### signatures

`Record`\<`string`, [`FactorySettlementSignature`](../interfaces/FactorySettlementSignature.md)\>

### chainProvider?

`ChainStateProvider`

### options?

#### coinProof?

`Uint8Array`\<`ArrayBufferLike`\>

Serialized CoinProof for the factory's shared UTXO (coinexport `data`).

#### verify?

(`sig`, `digest`, `pkd`) => `boolean`

## Returns

`Promise`\<[`FactorySettlementPayload`](../interfaces/FactorySettlementPayload.md)\>
