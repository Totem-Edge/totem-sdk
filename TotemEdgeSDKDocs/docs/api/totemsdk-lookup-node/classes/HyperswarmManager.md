[**@totemsdk/lookup-node**](../index.md)

***

[@totemsdk/lookup-node](../index.md) / HyperswarmManager

# Class: HyperswarmManager

## Constructors

### Constructor

> **new HyperswarmManager**(`node`, `config`): `HyperswarmManager`

#### Parameters

##### node

[`LookupNode`](LookupNode.md)

##### config

[`HyperswarmManagerConfig`](../interfaces/HyperswarmManagerConfig.md)

#### Returns

`HyperswarmManager`

## Accessors

### connectionCount

#### Get Signature

> **get** **connectionCount**(): `number`

##### Returns

`number`

## Methods

### start()

> **start**(): `Promise`\<`void`\>

Joins the Hyperswarm topic and begins accepting connections.
Each incoming connection is wrapped in a HyperswarmTransport and
handed to LookupNode.handleConnection().

#### Returns

`Promise`\<`void`\>

***

### stop()

> **stop**(): `Promise`\<`void`\>

Leave the topic and destroy the Hyperswarm instance.
Call node.stop() separately to shut down the LookupNode.

#### Returns

`Promise`\<`void`\>
