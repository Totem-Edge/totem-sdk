[**@totemsdk/lookup-protocol**](../index.md)

***

[@totemsdk/lookup-protocol](../index.md) / AppAnnounceMessage

# Interface: AppAnnounceMessage

## Extends

- `BaseMessage`

## Properties

### id?

> `optional` **id?**: `string`

#### Inherited from

`BaseMessage.id`

***

### payload

> **payload**: `object`

#### appId

> **appId**: `string`

#### authorAddress?

> `optional` **authorAddress?**: `string`

Minima address of the app author — stored as a filterable column for APP_QUERY.
Authoritative source is inside the manifest; this top-level field enables
discovery before a full AppManifest parser is available.

#### expiresAt

> **expiresAt**: `number`

#### isFree?

> `optional` **isFree?**: `boolean`

If true the app charges no fees — used for freeOnly filter in APP_QUERY.

#### manifest

> **manifest**: `Uint8Array`

#### publicKey?

> `optional` **publicKey?**: `string`

Hex-encoded Ed25519 public key of the signer (required for signature verification)

#### signature?

> `optional` **signature?**: `string`

Hex-encoded Ed25519 signature over manifest bytes

***

### sig?

> `optional` **sig?**: `string`

#### Inherited from

`BaseMessage.sig`

***

### type

> **type**: `"APP_ANNOUNCE"`

#### Overrides

`BaseMessage.type`

***

### version

> **version**: `number`

#### Inherited from

`BaseMessage.version`
