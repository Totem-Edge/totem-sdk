[**@totemsdk/edge-mqtt**](../index.md)

***

[@totemsdk/edge-mqtt](../index.md) / MqttProofPublisherConfig

# Interface: MqttProofPublisherConfig

## Properties

### client

> **client**: [`MqttClientPort`](MqttClientPort.md)

***

### defaultProofTopic

> **defaultProofTopic**: `string`

***

### defaultReceiptTopic?

> `optional` **defaultReceiptTopic?**: `string`

***

### issuer?

> `optional` **issuer?**: `string`

Issuer identity used in proof-package mode. Falls back to runtime.deviceId then 'unknown'.

***

### keyIndex?

> `optional` **keyIndex?**: `number`

WOTS key index for direct signing (used when no leaseProvider is given).

***

### leaseProvider?

> `optional` **leaseProvider?**: `object`

WOTS lease provider for coordinated key-index reservation.
When set, keyIndex is ignored and the index is reserved via the provider.

#### burnReservation()

> **burnReservation**(`reservationId`, `reason`): `Promise`\<`void`\>

##### Parameters

###### reservationId

`string`

###### reason

`string`

##### Returns

`Promise`\<`void`\>

#### commitKeyUse()

> **commitKeyUse**(`reservationId`, `txId`): `Promise`\<`void`\>

##### Parameters

###### reservationId

`string`

###### txId

`string`

##### Returns

`Promise`\<`void`\>

#### reserveKeyUse()

> **reserveKeyUse**(`params`): `Promise`\<\{ `indices`: \{ `addressIndex`: `number`; `l1`: `number`; `l2`: `number`; \}; `reservationId`: `string`; \}\>

##### Parameters

###### params

###### payloadHash?

`string`

###### treeId

`string`

###### ttlMs?

`number`

##### Returns

`Promise`\<\{ `indices`: \{ `addressIndex`: `number`; `l1`: `number`; `l2`: `number`; \}; `reservationId`: `string`; \}\>

***

### leaseTreeId?

> `optional` **leaseTreeId?**: `string`

***

### metadata?

> `optional` **metadata?**: `Record`\<`string`, `unknown`\>

***

### proofMode?

> `optional` **proofMode?**: `"edge-port"` \| `"proof-package"`

***

### runtime

> **runtime**: `EdgeRuntime`

***

### seed?

> `optional` **seed?**: `Uint8Array`\<`ArrayBufferLike`\>

32-byte WOTS seed for signing proofs in proof-package mode.
