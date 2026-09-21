[**@totemsdk/storage**](../index.md)

***

[@totemsdk/storage](../index.md) / assertCapabilities

# Function: assertCapabilities()

> **assertCapabilities**(`adapter`, `required`): `void`

No-silent-downgrade guard (RFC-007 §4.2). A consumer that requires
`durably-acknowledged`, atomic, or conditional writes must reject an adapter
that cannot provide them at construction time.

## Parameters

### adapter

[`StorageAdapterWithCapabilities`](../interfaces/StorageAdapterWithCapabilities.md)

### required

`Partial`\<[`StoreCapabilities`](../interfaces/StoreCapabilities.md)\>

## Returns

`void`
