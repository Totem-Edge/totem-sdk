[**@totemsdk/edge-opcua**](../index.md)

***

[@totemsdk/edge-opcua](../index.md) / OpcuaSubscription

# Interface: OpcuaSubscription

## Methods

### addNodes()

> **addNodes**(`nodeIds`): `Promise`\<`void`\>

Add nodes to the subscription.

#### Parameters

##### nodeIds

`string`[]

#### Returns

`Promise`\<`void`\>

***

### destroy()

> **destroy**(): `Promise`\<`void`\>

Destroy the subscription.

#### Returns

`Promise`\<`void`\>

***

### onChange()

> **onChange**(`handler`): () => `void`

Register handler for value changes.

#### Parameters

##### handler

(`events`) => `void`

#### Returns

() => `void`

***

### removeNodes()

> **removeNodes**(`nodeIds`): `Promise`\<`void`\>

Remove nodes from the subscription.

#### Parameters

##### nodeIds

`string`[]

#### Returns

`Promise`\<`void`\>
