[**@totemsdk/edge-matter**](../index.md)

***

[@totemsdk/edge-matter](../index.md) / MatterSubscription

# Interface: MatterSubscription

## Methods

### cancel()

> **cancel**(): `Promise`\<`void`\>

Cancel the subscription.

#### Returns

`Promise`\<`void`\>

***

### onChange()

> **onChange**(`handler`): () => `void`

Register handler for attribute change reports.

#### Parameters

##### handler

(`reports`) => `void`

#### Returns

() => `void`
