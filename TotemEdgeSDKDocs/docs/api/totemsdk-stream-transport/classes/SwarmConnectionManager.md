[**@totemsdk/stream-transport**](../index.md)

***

[@totemsdk/stream-transport](../index.md) / SwarmConnectionManager

# Class: SwarmConnectionManager

Owns a single Hyperswarm instance and dispatches connections to matching
waits. Fixes the per-call swarm/listener leak, topic cross-talk and
`flush()`-as-readiness defects (RFC-057 D2/D10/D11).

## Constructors

### Constructor

> **new SwarmConnectionManager**(`_options?`): `SwarmConnectionManager`

#### Parameters

##### \_options?

[`SwarmConnectionManagerOptions`](../interfaces/SwarmConnectionManagerOptions.md) = `{}`

#### Returns

`SwarmConnectionManager`

## Methods

### close()

> **close**(): `Promise`\<`void`\>

Close every transport, leave joined topics and destroy the swarm.

#### Returns

`Promise`\<`void`\>

***

### connect()

> **connect**(`topic`, `options?`): `Promise`\<[`HyperswarmStreamTransport`](HyperswarmStreamTransport.md)\>

Join a topic (once) and wait for the first matching peer connection.

#### Parameters

##### topic

`string` \| `Buffer`\<`ArrayBufferLike`\> \| `Uint8Array`\<`ArrayBufferLike`\>

##### options?

[`SwarmConnectionOptions`](../interfaces/SwarmConnectionOptions.md) = `{}`

#### Returns

`Promise`\<[`HyperswarmStreamTransport`](HyperswarmStreamTransport.md)\>
