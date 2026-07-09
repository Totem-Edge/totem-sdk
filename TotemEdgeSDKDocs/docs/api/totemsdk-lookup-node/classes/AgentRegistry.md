[**@totemsdk/lookup-node**](../index.md)

***

[@totemsdk/lookup-node](../index.md) / AgentRegistry

# Class: AgentRegistry

## Constructors

### Constructor

> **new AgentRegistry**(`store`, `requireSignature?`): `AgentRegistry`

#### Parameters

##### store

[`SqliteStore`](SqliteStore.md)

SQLite backing store

##### requireSignature?

`boolean` = `true`

When true (default), announcements without a valid
  Ed25519 signature are silently rejected.

#### Returns

`AgentRegistry`

## Methods

### announce()

> **announce**(`msg`, `nodeId`): `Promise`\<`void`\>

#### Parameters

##### msg

`AgentAnnounceMessage`

##### nodeId

`string`

#### Returns

`Promise`\<`void`\>

***

### query()

> **query**(`msg`, `sendFn`): `void`

#### Parameters

##### msg

`AgentQueryMessage`

##### sendFn

`SendFn`

#### Returns

`void`

***

### removeExpired()

> **removeExpired**(): `void`

#### Returns

`void`

***

### size()

> **size**(): `number`

#### Returns

`number`

***

### startExpiryLoop()

> **startExpiryLoop**(`intervalMs`): `void`

#### Parameters

##### intervalMs

`number`

#### Returns

`void`

***

### stopExpiryLoop()

> **stopExpiryLoop**(): `void`

#### Returns

`void`
