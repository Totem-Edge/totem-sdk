[**@totemsdk/edge-ros2**](../index.md)

***

[@totemsdk/edge-ros2](../index.md) / Ros2Gateway

# Interface: Ros2Gateway

## Properties

### status

> `readonly` **status**: `"stopped"` \| `"running"` \| `"error"`

## Methods

### callService()

> **callService**(`service`, `serviceType`, `request`, `timeoutMs?`): `Promise`\<`EdgeOperationResult`\<\{ `response`: [`Ros2Message`](Ros2Message.md); \}\>\>

Call a service.

#### Parameters

##### service

`string`

##### serviceType

`string`

##### request

[`Ros2Message`](Ros2Message.md)

##### timeoutMs?

`number`

#### Returns

`Promise`\<`EdgeOperationResult`\<\{ `response`: [`Ros2Message`](Ros2Message.md); \}\>\>

***

### createPublisher()

> **createPublisher**(`topic`, `messageType`): `Promise`\<[`Ros2Publisher`](Ros2Publisher.md)\>

Create a publisher on a typed topic.

#### Parameters

##### topic

`string`

##### messageType

`string`

#### Returns

`Promise`\<[`Ros2Publisher`](Ros2Publisher.md)\>

***

### createSubscription()

> **createSubscription**(`topic`, `messageType`, `handler`): `Promise`\<[`Ros2Subscription`](Ros2Subscription.md)\>

Create a subscription on a typed topic.

#### Parameters

##### topic

`string`

##### messageType

`string`

##### handler

(`msg`) => `void`

#### Returns

`Promise`\<[`Ros2Subscription`](Ros2Subscription.md)\>

***

### start()

> **start**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### stop()

> **stop**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>
