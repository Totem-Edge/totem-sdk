[**@totemsdk/act-core**](../index.md)

***

[@totemsdk/act-core](../index.md) / ActionEventStream

# Interface: ActionEventStream

## Extends

- [`ActionEventSink`](ActionEventSink.md)

## Methods

### emit()

> **emit**(`event`): `void` \| `Promise`\<`void`\>

#### Parameters

##### event

[`IndustrialActionEvent`](IndustrialActionEvent.md)

#### Returns

`void` \| `Promise`\<`void`\>

#### Inherited from

[`ActionEventSink`](ActionEventSink.md).[`emit`](ActionEventSink.md#emit)

***

### list()

> **list**(): `Promise`\<[`IndustrialActionEvent`](IndustrialActionEvent.md)[]\>

#### Returns

`Promise`\<[`IndustrialActionEvent`](IndustrialActionEvent.md)[]\>
