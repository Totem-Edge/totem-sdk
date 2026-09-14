[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / IngressOptions

# Interface: IngressOptions

## Properties

### digest

> **digest**: `MessageDigester`

Canonical digest computation.

***

### maxBytes?

> `optional` **maxBytes?**: `number`

Max message size in bytes.

***

### recipient

> **recipient**: `string`

Local recipient address.

***

### replayLedger

> **replayLedger**: [`ReplayLedger`](ReplayLedger.md)

Replay ledger (durable).

***

### verifySignature

> **verifySignature**: `SignatureVerifier`

Signature verification.
