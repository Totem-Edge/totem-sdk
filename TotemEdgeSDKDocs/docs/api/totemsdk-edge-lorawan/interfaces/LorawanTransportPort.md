[**@totemsdk/edge-lorawan**](../index.md)

***

[@totemsdk/edge-lorawan](../index.md) / LorawanTransportPort

# Interface: LorawanTransportPort

LoRaWAN transport port — injected by the caller.

Supports OTAA (Over-The-Air Activation) and ABP (Activation By
Personalization). The caller provides the radio or network server.

## Methods

### activateAbp()

> **activateAbp**(`devAddr`, `nwkSKey`, `appSKey`): `Promise`\<`void`\>

Activate via ABP with pre-provisioned keys.

#### Parameters

##### devAddr

`string`

##### nwkSKey

`string`

##### appSKey

`string`

#### Returns

`Promise`\<`void`\>

***

### joinOtaa()

> **joinOtaa**(`devEui`, `appEui`, `appKey`): `Promise`\<`void`\>

Join the network via OTAA.

#### Parameters

##### devEui

`string`

##### appEui

`string`

##### appKey

`string`

#### Returns

`Promise`\<`void`\>

***

### onDownlink()

> **onDownlink**(`handler`): () => `void`

Register handler for downlink messages.

#### Parameters

##### handler

(`message`) => `void`

#### Returns

() => `void`

***

### onError()

> **onError**(`handler`): () => `void`

Register handler for errors.

#### Parameters

##### handler

(`err`) => `void`

#### Returns

() => `void`

***

### onJoin()

> **onJoin**(`handler`): () => `void`

Register handler for join/activation events.

#### Parameters

##### handler

(`devAddr`) => `void`

#### Returns

() => `void`

***

### sendConfirmed()

> **sendConfirmed**(`port`, `data`): `Promise`\<`void`\>

Send a confirmed uplink (requires ACK).

#### Parameters

##### port

`number`

##### data

`Uint8Array`

#### Returns

`Promise`\<`void`\>

***

### sendUnconfirmed()

> **sendUnconfirmed**(`port`, `data`): `Promise`\<`void`\>

Send an unconfirmed uplink (no ACK).

#### Parameters

##### port

`number`

##### data

`Uint8Array`

#### Returns

`Promise`\<`void`\>
