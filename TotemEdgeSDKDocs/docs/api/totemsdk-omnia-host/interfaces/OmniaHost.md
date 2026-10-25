[**@totemsdk/omnia-host**](../index.md)

***

[@totemsdk/omnia-host](../index.md) / OmniaHost

# Interface: OmniaHost

## Properties

### channels?

> `readonly` `optional` **channels?**: `Map`\<`string`, `OmniaChannel`\>

***

### config

> `readonly` **config**: [`OmniaHostConfig`](OmniaHostConfig.md)

***

### p2pHubUrl?

> `readonly` `optional` **p2pHubUrl?**: `string`

Loopback WebSocket endpoint for local dapps, when enabled (RFC-062).

***

### swarm?

> `readonly` `optional` **swarm?**: `OmniaSwarm`

## Methods

### close()

> **close**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### isStarted()

> **isStarted**(): `boolean`

#### Returns

`boolean`

***

### start()

> **start**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>
