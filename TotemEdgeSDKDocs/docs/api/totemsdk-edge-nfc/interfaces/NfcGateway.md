[**@totemsdk/edge-nfc**](../index.md)

***

[@totemsdk/edge-nfc](../index.md) / NfcGateway

# Interface: NfcGateway

## Properties

### status

> `readonly` **status**: `"stopped"` \| `"running"` \| `"error"`

***

### tags

> `readonly` **tags**: [`NfcTag`](NfcTag.md)[]

Currently-visible tags.

## Methods

### eraseNdef()

> **eraseNdef**(`tagId`): `Promise`\<`EdgeOperationResult`\<`unknown`\>\>

Erase NDEF data from a present tag.

#### Parameters

##### tagId

`string`

#### Returns

`Promise`\<`EdgeOperationResult`\<`unknown`\>\>

***

### getTag()

> **getTag**(`tagId`): [`NfcTag`](NfcTag.md) \| `null`

Resolve a tag by handle (id) or uid; returns null if not present.

#### Parameters

##### tagId

`string`

#### Returns

[`NfcTag`](NfcTag.md) \| `null`

***

### onMessage()

> **onMessage**(`handler`): () => `void`

Register a handler for inbound peer-to-peer NDEF messages.

#### Parameters

##### handler

(`records`) => `void`

#### Returns

() => `void`

***

### putMessage()

> **putMessage**(`records`): `Promise`\<`EdgeOperationResult`\<`unknown`\>\>

Send an NDEF message to a peer NFC-DEP target.

#### Parameters

##### records

[`NdefRecord`](NdefRecord.md)[]

#### Returns

`Promise`\<`EdgeOperationResult`\<`unknown`\>\>

***

### readNdef()

> **readNdef**(`tagId`): `Promise`\<`EdgeOperationResult`\<\{ `records`: [`NdefRecord`](NdefRecord.md)[]; \}\>\>

Read NDEF records off a present tag.

#### Parameters

##### tagId

`string`

#### Returns

`Promise`\<`EdgeOperationResult`\<\{ `records`: [`NdefRecord`](NdefRecord.md)[]; \}\>\>

***

### registerHceApduHandler()

> **registerHceApduHandler**(`handler`): `Promise`\<`void`\>

Serve an HCE APDU handler to an external reader.

#### Parameters

##### handler

[`HceApduHandler`](../type-aliases/HceApduHandler.md)

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

***

### transceive()

> **transceive**(`tagId`, `apdu`): `Promise`\<`EdgeOperationResult`\<\{ `response`: `Uint8Array`; \}\>\>

ISO 7816-4 APDU exchange (secure element).

#### Parameters

##### tagId

`string`

##### apdu

`Uint8Array`

#### Returns

`Promise`\<`EdgeOperationResult`\<\{ `response`: `Uint8Array`; \}\>\>

***

### unregisterHceApduHandler()

> **unregisterHceApduHandler**(): `Promise`\<`void`\>

Stop serving HCE APDUs.

#### Returns

`Promise`\<`void`\>

***

### writeNdef()

> **writeNdef**(`tagId`, `records`): `Promise`\<`EdgeOperationResult`\<`unknown`\>\>

Write NDEF records to a present tag.

#### Parameters

##### tagId

`string`

##### records

[`NdefRecord`](NdefRecord.md)[]

#### Returns

`Promise`\<`EdgeOperationResult`\<`unknown`\>\>
