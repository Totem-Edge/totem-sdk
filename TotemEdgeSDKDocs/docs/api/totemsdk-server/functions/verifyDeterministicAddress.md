[**@totemsdk/server**](../index.md)

***

[@totemsdk/server](../index.md) / verifyDeterministicAddress

# Function: verifyDeterministicAddress()

> **verifyDeterministicAddress**(`baseSeed`, `addressIndex`, `expectedAddress`, `scheme?`): `boolean`

Fail-loud check: does the node-returned `expectedAddress` equal the address
derived from the seed? Use this instead of trusting `newaddress` blindly.

## Parameters

### baseSeed

`Uint8Array`

### addressIndex

`number`

### expectedAddress

`string`

### scheme?

[`AddressScheme`](../type-aliases/AddressScheme.md)

## Returns

`boolean`
