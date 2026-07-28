[**@totemsdk/pear**](../index.md)

***

[@totemsdk/pear](../index.md) / BareHyperswarm

# Class: BareHyperswarm

## Constructors

### Constructor

> **new BareHyperswarm**(): `BareHyperswarm`

#### Returns

`BareHyperswarm`

## Methods

### close()

> **close**(): `Promise`\<`void`\>

Destroy the underlying Hyperswarm instance.

#### Returns

`Promise`\<`void`\>

***

### connect()

> **connect**(`topic`, `options?`): `Promise`\<`IStreamTransport`\>

Join a Hyperswarm topic and wait for the first inbound connection.
Returns an `IStreamTransport` wrapping that connection.

#### Parameters

##### topic

`string` \| `Uint8Array`\<`ArrayBufferLike`\>

##### options?

[`SwarmConnectOptions`](../interfaces/SwarmConnectOptions.md) = `{}`

#### Returns

`Promise`\<`IStreamTransport`\>
