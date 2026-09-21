[**@totemsdk/edge-nfc**](../index.md)

***

[@totemsdk/edge-nfc](../index.md) / NfcTag

# Interface: NfcTag

A detected NFC tag/card.

## Properties

### detectedAt

> **detectedAt**: `number`

Time the tag was first detected (ms epoch).

***

### id

> **id**: `string`

Stable handle for this tag while it is present.

***

### tech

> **tech**: `string`

Technology family, e.g. "iso14443a", "iso14443b", "felica".

***

### uid

> **uid**: `string`

Tag UID as hex string.
