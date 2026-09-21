[**@totemsdk/omnia-factory**](../index.md)

***

[@totemsdk/omnia-factory](../index.md) / DurableFactoryStore

# Interface: DurableFactoryStore

## Methods

### getFactory()

> **getFactory**(`factoryId`): `Promise`\<[`ChannelFactory`](ChannelFactory.md) \| `undefined`\>

#### Parameters

##### factoryId

`string`

#### Returns

`Promise`\<[`ChannelFactory`](ChannelFactory.md) \| `undefined`\>

***

### getRevision()

> **getRevision**(): `Promise`\<`number`\>

Current registry transition counter (0 before the first write).

#### Returns

`Promise`\<`number`\>

***

### getSnapshot()

> **getSnapshot**(): `Promise`\<[`FactoryRegistryState`](FactoryRegistryState.md)\>

Current persisted registry state.

#### Returns

`Promise`\<[`FactoryRegistryState`](FactoryRegistryState.md)\>

***

### hasState()

> **hasState**(): `Promise`\<`boolean`\>

True once any factory record has been persisted.

#### Returns

`Promise`\<`boolean`\>

***

### listFactories()

> **listFactories**(): `Promise`\<[`ChannelFactory`](ChannelFactory.md)[]\>

All factories known to the registry.

#### Returns

`Promise`\<[`ChannelFactory`](ChannelFactory.md)[]\>

***

### saveFactory()

> **saveFactory**(`factory`): `Promise`\<`void`\>

Persist a factory (create/accept/reallocate state transition).

#### Parameters

##### factory

[`ChannelFactory`](ChannelFactory.md)

#### Returns

`Promise`\<`void`\>
