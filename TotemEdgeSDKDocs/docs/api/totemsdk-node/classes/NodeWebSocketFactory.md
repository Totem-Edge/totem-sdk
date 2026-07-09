[**@totemsdk/node**](../index.md)

***

[@totemsdk/node](../index.md) / NodeWebSocketFactory

# Class: NodeWebSocketFactory

## Implements

- [`WebSocketFactory`](../interfaces/WebSocketFactory.md)

## Constructors

### Constructor

> **new NodeWebSocketFactory**(`defaultOptions?`): `NodeWebSocketFactory`

#### Parameters

##### defaultOptions?

[`WebSocketFactoryOptions`](../interfaces/WebSocketFactoryOptions.md)

#### Returns

`NodeWebSocketFactory`

## Methods

### create()

> **create**(`url`, `protocols?`, `options?`): [`WebSocketClient`](../interfaces/WebSocketClient.md)

#### Parameters

##### url

`string`

##### protocols?

`string`[]

##### options?

[`WebSocketFactoryOptions`](../interfaces/WebSocketFactoryOptions.md)

#### Returns

[`WebSocketClient`](../interfaces/WebSocketClient.md)

#### Implementation of

[`WebSocketFactory`](../interfaces/WebSocketFactory.md).[`create`](../interfaces/WebSocketFactory.md#create)

***

### dispose()

> **dispose**(): `void`

#### Returns

`void`

#### Implementation of

[`WebSocketFactory`](../interfaces/WebSocketFactory.md).[`dispose`](../interfaces/WebSocketFactory.md#dispose)
