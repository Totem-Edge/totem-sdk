[**@totemsdk/edge-ros2**](../index.md)

***

[@totemsdk/edge-ros2](../index.md) / Ros2TransportPort

# Interface: Ros2TransportPort

ROS 2 transport port — injected by the caller.

ROS 2 uses DDS (Data Distribution Service) middleware for discovery,
publish/subscribe, and service calls. The caller provides the DDS
implementation (eProsima Fast DDS, Cyclone DDS, or rmw layer).

## Methods

### createClient()

> **createClient**(`service`, `serviceType`): `Promise`\<[`Ros2Client`](Ros2Client.md)\>

Create a service client.

#### Parameters

##### service

`string`

##### serviceType

`string`

#### Returns

`Promise`\<[`Ros2Client`](Ros2Client.md)\>

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

### createService()

> **createService**(`service`, `serviceType`, `handler`): `Promise`\<[`Ros2Server`](Ros2Server.md)\>

Create a service server.

#### Parameters

##### service

`string`

##### serviceType

`string`

##### handler

(`request`) => `Promise`\<[`Ros2Message`](Ros2Message.md)\>

#### Returns

`Promise`\<[`Ros2Server`](Ros2Server.md)\>

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

### init()

> **init**(`args?`): `Promise`\<`void`\>

Initialise the ROS 2 context.

#### Parameters

##### args?

`string`[]

#### Returns

`Promise`\<`void`\>

***

### onError()

> **onError**(`handler`): () => `void`

Register handler for node errors.

#### Parameters

##### handler

(`err`) => `void`

#### Returns

() => `void`

***

### shutdown()

> **shutdown**(): `Promise`\<`void`\>

Shutdown the ROS 2 context.

#### Returns

`Promise`\<`void`\>
