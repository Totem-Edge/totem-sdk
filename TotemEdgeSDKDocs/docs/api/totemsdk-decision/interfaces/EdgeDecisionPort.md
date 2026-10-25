[**@totemsdk/decision**](../index.md)

***

[@totemsdk/decision](../index.md) / EdgeDecisionPort

# Interface: EdgeDecisionPort

Edge-compatible decision port contract.

Lives in @totemsdk/decision (not @totemsdk/edge) so the composition seam does
not create an edge dependency. @totemsdk/edge re-exports this type and hosts
implementations via `EdgeRuntimePorts.decision`.

## Properties

### capabilities

> `readonly` **capabilities**: readonly [`DecisionCapability`](../type-aliases/DecisionCapability.md)[]

Capability strings advertised (e.g. ['decision:choice', …]).

***

### runtimeId

> `readonly` **runtimeId**: `string`

Stable runtime/provider id (e.g. 'decision').

## Methods

### cancel()?

> `optional` **cancel**(`requestId`): `Promise`\<[`DecisionPortResult`](DecisionPortResult.md)\<`unknown`\>\>

#### Parameters

##### requestId

`string`

#### Returns

`Promise`\<[`DecisionPortResult`](DecisionPortResult.md)\<`unknown`\>\>

***

### close()?

> `optional` **close**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### decide()

> **decide**(`params`): `Promise`\<[`DecisionPortResult`](DecisionPortResult.md)\<`unknown`\>\>

#### Parameters

##### params

###### request

[`DecisionRequest`](../type-aliases/DecisionRequest.md)

#### Returns

`Promise`\<[`DecisionPortResult`](DecisionPortResult.md)\<`unknown`\>\>
