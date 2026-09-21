[**@totemsdk/edge-nfc**](../index.md)

***

[@totemsdk/edge-nfc](../index.md) / NfcTransportPort

# Interface: NfcTransportPort

## Methods

### eraseNdef()

> **eraseNdef**(`tagId`): `Promise`\<`void`\>

Erase NDEF data from a present tag.

#### Parameters

##### tagId

`string`

#### Returns

`Promise`\<`void`\>

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

### onMessage()

> **onMessage**(`handler`): () => `void`

Register handler for inbound peer-to-peer messages.

#### Parameters

##### handler

(`records`) => `void`

#### Returns

() => `void`

***

### onTag()

> **onTag**(`handler`): () => `void`

Register handler for new tag detection.

#### Parameters

##### handler

(`event`) => `void`

#### Returns

() => `void`

***

### onTagLost()

> **onTagLost**(`handler`): () => `void`

Register handler for tag removal.

#### Parameters

##### handler

(`event`) => `void`

#### Returns

() => `void`

***

### putMessage()

> **putMessage**(`record`): `Promise`\<`void`\>

Peer-to-peer: put a message to a peer P2P target (NFC-DEP / SNEP LLCP).

#### Parameters

##### record

[`NdefRecord`](NdefRecord.md)[]

#### Returns

`Promise`\<`void`\>

***

### readNdef()

> **readNdef**(`tagId`): `Promise`\<[`NdefRecord`](NdefRecord.md)[]\>

Read NDEF messages off a present tag.

#### Parameters

##### tagId

`string`

#### Returns

`Promise`\<[`NdefRecord`](NdefRecord.md)[]\>

***

### registerHceApduHandler()

> **registerHceApduHandler**(`handler`): `Promise`\<`void`\>

Host Card Emulation: serve an APDU handler to an external reader.

#### Parameters

##### handler

[`HceApduHandler`](../type-aliases/HceApduHandler.md)

#### Returns

`Promise`\<`void`\>

***

### startPolling()

> **startPolling**(`options?`): `Promise`\<`void`\>

Begin reader polling for tags.

#### Parameters

##### options?

###### techs?

`string`[]

#### Returns

`Promise`\<`void`\>

***

### stopPolling()

> **stopPolling**(): `Promise`\<`void`\>

Stop reader polling.

#### Returns

`Promise`\<`void`\>

***

### transceive()

> **transceive**(`tagId`, `apdu`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

ISO 7816-4 APDU exchange with a secure-element tag (Type 4 capable).

#### Parameters

##### tagId

`string`

##### apdu

`Uint8Array`

#### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

***

### unregisterHceApduHandler()

> **unregisterHceApduHandler**(): `Promise`\<`void`\>

Stop serving host-card-emulation APDUs.

#### Returns

`Promise`\<`void`\>

***

### waitForTag()

> **waitForTag**(`timeoutMs?`): `Promise`\<[`NfcTag`](NfcTag.md) \| `null`\>

Block until a tag appears, or timeoutMs elapses (returns null on timeout).

#### Parameters

##### timeoutMs?

`number`

#### Returns

`Promise`\<[`NfcTag`](NfcTag.md) \| `null`\>

***

### writeNdef()

> **writeNdef**(`tagId`, `records`): `Promise`\<`void`\>

Write an NDEF message to a present tag (contactless / re-writable tags).

#### Parameters

##### tagId

`string`

##### records

[`NdefRecord`](NdefRecord.md)[]

#### Returns

`Promise`\<`void`\>
