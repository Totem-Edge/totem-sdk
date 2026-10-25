[**@totemsdk/omnia-relay**](../index.md)

***

[@totemsdk/omnia-relay](../index.md) / RelayOmniaClient

# Interface: RelayOmniaClient

## Properties

### channels

> `readonly` **channels**: `Map`\<`string`, [`OmniaChannel`](OmniaChannel.md)\>

***

### swarm

> `readonly` **swarm**: `OmniaSwarm`

## Methods

### close()

> **close**(): `Promise`\<`void`\>

Tear down the relay connection + inbound handlers.

#### Returns

`Promise`\<`void`\>

***

### closeChannel()

> **closeChannel**(`params`): `Promise`\<`unknown`\>

#### Parameters

##### params

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`unknown`\>

***

### closeFactory()

> **closeFactory**(`params`): `Promise`\<`unknown`\>

#### Parameters

##### params

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`unknown`\>

***

### createFactory()

> **createFactory**(`params`): `Promise`\<`unknown`\>

#### Parameters

##### params

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`unknown`\>

***

### getChannels()

> **getChannels**(`params?`): `Promise`\<`unknown`\>

#### Parameters

##### params?

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`unknown`\>

***

### getChannelState()

> **getChannelState**(`params`): `Promise`\<`unknown`\>

#### Parameters

##### params

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`unknown`\>

***

### getRoute()

> **getRoute**(`params`): `Promise`\<`unknown`\>

#### Parameters

##### params

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`unknown`\>

***

### getSwapRate()

> **getSwapRate**(`params`): `Promise`\<`unknown`\>

#### Parameters

##### params

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`unknown`\>

***

### openChannel()

> **openChannel**(`params`): `Promise`\<`unknown`\>

#### Parameters

##### params

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`unknown`\>

***

### openVirtualChannel()

> **openVirtualChannel**(`params`): `Promise`\<`unknown`\>

#### Parameters

##### params

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`unknown`\>

***

### pay()

> **pay**(`params`): `Promise`\<`unknown`\>

#### Parameters

##### params

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`unknown`\>

***

### payMultiHop()

> **payMultiHop**(`params`): `Promise`\<`unknown`\>

#### Parameters

##### params

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`unknown`\>

***

### settle()

> **settle**(`params`): `Promise`\<`unknown`\>

#### Parameters

##### params

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`unknown`\>

***

### spliceIn()

> **spliceIn**(`params`): `Promise`\<`unknown`\>

#### Parameters

##### params

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`unknown`\>

***

### spliceOut()

> **spliceOut**(`params`): `Promise`\<`unknown`\>

#### Parameters

##### params

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`unknown`\>

***

### supports()

> **supports**(`method`): `boolean` \| \{ `reason?`: `string`; `supported`: `boolean`; \}

Per-method capability probe (RFC-014 Amendment A). Accepts either the Omnia
client method name (`createFactory`) or the connect name
(`totem_omniaCreateFactory`); returns a verdict so the wallet manifest
reflects what this client will actually attempt.

#### Parameters

##### method

`string`

#### Returns

`boolean` \| \{ `reason?`: `string`; `supported`: `boolean`; \}
