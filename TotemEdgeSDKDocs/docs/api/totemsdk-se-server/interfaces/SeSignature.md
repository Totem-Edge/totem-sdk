[**@totemsdk/se-server**](../index.md)

***

[@totemsdk/se-server](../index.md) / SeSignature

# Interface: SeSignature

One SE signature: a leased WotsProof plus the identity version it belongs to.

## Properties

### address

> `readonly` **address**: `string`

***

### childIndex

> `readonly` **childIndex**: `number`

***

### kind

> `readonly` **kind**: `"child"` \| `"root"`

`child` = off-chain transfer blind-signature; `root` = on-chain claim co-signature.

***

### member

> `readonly` **member**: `string`

***

### message

> `readonly` **message**: `string`

***

### proofVersion

> `readonly` **proofVersion**: `number`

***

### publicKey

> `readonly` **publicKey**: `string`

***

### signature

> `readonly` **signature**: `string`

Serialized `TreeSignature` hex (one-time leaf signature).
