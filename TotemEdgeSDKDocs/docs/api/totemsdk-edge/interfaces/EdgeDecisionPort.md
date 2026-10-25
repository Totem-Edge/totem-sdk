[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / EdgeDecisionPort

# Interface: EdgeDecisionPort

Edge-compatible decision port contract.

Lives in @totemsdk/decision (not @totemsdk/edge) so the composition seam does
not create an edge dependency. @totemsdk/edge re-exports this type and hosts
implementations via `EdgeRuntimePorts.decision`.

## Properties

### capabilities

> `readonly` **capabilities**: readonly `DecisionCapability`[]

Capability strings advertised (e.g. ['decision:choice', …]).

***

### runtimeId

> `readonly` **runtimeId**: `string`

Stable runtime/provider id (e.g. 'decision').

## Methods

### cancel()?

> `optional` **cancel**(`requestId`): `Promise`\<`DecisionPortResult`\<`unknown`\>\>

#### Parameters

##### requestId

`string`

#### Returns

`Promise`\<`DecisionPortResult`\<`unknown`\>\>

***

### close()?

> `optional` **close**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### decide()

> **decide**(`params`): `Promise`\<`DecisionPortResult`\<`unknown`\>\>

#### Parameters

##### params

###### request

`DecisionRequest`

#### Returns

`Promise`\<`DecisionPortResult`\<`unknown`\>\>
