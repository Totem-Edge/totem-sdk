[**@totemsdk/edge-mavlink**](../index.md)

***

[@totemsdk/edge-mavlink](../index.md) / MavlinkGateway

# Interface: MavlinkGateway

## Properties

### status

> `readonly` **status**: `"stopped"` \| `"running"` \| `"error"`

## Methods

### command()

> **command**(`command`, `params?`, `timeoutMs?`): `Promise`\<`EdgeOperationResult`\<[`MavlinkCommandResult`](MavlinkCommandResult.md)\>\>

#### Parameters

##### command

`number`

##### params?

`number`[]

##### timeoutMs?

`number`

#### Returns

`Promise`\<`EdgeOperationResult`\<[`MavlinkCommandResult`](MavlinkCommandResult.md)\>\>

***

### onMessage()

> **onMessage**(`messageId`, `handler`): () => `void`

Subscribe to a message id, or '*' for all decoded messages.

#### Parameters

##### messageId

`number` \| `"*"`

##### handler

[`MavlinkMessageHandler`](../type-aliases/MavlinkMessageHandler.md)

#### Returns

() => `void`

***

### sendHeartbeat()

> **sendHeartbeat**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

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
