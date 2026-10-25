[**@totemsdk/omnia-factory**](../index.md)

***

[@totemsdk/omnia-factory](../index.md) / buildFactoryOpening

# Function: buildFactoryOpening()

> **buildFactoryOpening**(`participants`, `tokenId`, `tokenScale`, `chainProvider?`, `funding?`): `Promise`\<[`FactoryOpeningPlan`](../interfaces/FactoryOpeningPlan.md)\>

Build a factory and (when every participant supplies a funding coin) its
deterministic funding draft, without signing or broadcasting.

## Parameters

### participants

[`FactoryParticipant`](../interfaces/FactoryParticipant.md)[]

### tokenId

`string`

### tokenScale

`number`

### chainProvider?

`ChainStateProvider`

### funding?

[`FactoryFundingMaterial`](../interfaces/FactoryFundingMaterial.md)[]

## Returns

`Promise`\<[`FactoryOpeningPlan`](../interfaces/FactoryOpeningPlan.md)\>
