[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / MandateEnforcementConfig

# Interface: MandateEnforcementConfig

## Properties

### expiresAtBlock

> **expiresAtBlock**: `bigint`

Expiry block for the mandate.

***

### expiryPort?

> `optional` **expiryPort?**: `number`

Port for expiresAt block (default 4).

***

### grantor

> **grantor**: `string`

***

### noncePort?

> `optional` **noncePort?**: `number`

Nonce port for replay protection (default 5).

***

### revocationEpoch

> **revocationEpoch**: `bigint`

***

### revocationEpochPort

> **revocationEpochPort**: `number`

***

### scope

> **scope**: `string`

Scope as a hex string (e.g., 'totem:gov:vote' encoded to hex).

***

### scopePort

> **scopePort**: `number`
