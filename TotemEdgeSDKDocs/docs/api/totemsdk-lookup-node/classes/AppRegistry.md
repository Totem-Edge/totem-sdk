[**@totemsdk/lookup-node**](../index.md)

***

[@totemsdk/lookup-node](../index.md) / AppRegistry

# Class: AppRegistry

## Constructors

### Constructor

> **new AppRegistry**(`store`, `requireSignature?`): `AppRegistry`

#### Parameters

##### store

[`SqliteStore`](SqliteStore.md)

SQLite backing store

##### requireSignature?

`boolean` = `true`

When true (default), announcements without a valid
  Ed25519 signature are silently rejected. Set false only for development
  or private trusted networks.

#### Returns

`AppRegistry`

## Methods

### announce()

> **announce**(`msg`, `nodeId`): `Promise`\<`void`\>

#### Parameters

##### msg

`AppAnnounceMessage`

##### nodeId

`string`

#### Returns

`Promise`\<`void`\>

***

### query()

> **query**(`msg`, `sendFn`): `void`

#### Parameters

##### msg

`AppQueryMessage`

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
