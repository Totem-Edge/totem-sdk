[**@totemsdk/edge-nfc**](../index.md)

***

[@totemsdk/edge-nfc](../index.md) / NdefRecord

# Interface: NdefRecord

An NDEF record (TNF + type + payload).

## Properties

### id?

> `optional` **id?**: `string`

Optional record identifier.

***

### payload

> **payload**: `Uint8Array`

***

### tnf

> **tnf**: `number`

Type Name Format: 0x01 well-known, 0x02 mime, 0x03 uri, 0x04 external.

***

### type

> **type**: `string`

Record type, e.g. "U", "T", "text/plain".
