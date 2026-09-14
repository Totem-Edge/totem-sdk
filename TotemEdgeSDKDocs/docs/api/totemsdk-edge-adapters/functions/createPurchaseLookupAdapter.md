[**@totemsdk/edge-adapters**](../index.md)

***

[@totemsdk/edge-adapters](../index.md) / createPurchaseLookupAdapter

# Function: createPurchaseLookupAdapter()

> **createPurchaseLookupAdapter**(`config`): `object`

Create a PurchaseLookupPort adapter over a LookupClient.

`resource` is treated as a capability name for agent manifests (the
machine-commerce case). If the resource matches a known app category, it
falls back to app queries. Returns `{ id, manifest: Uint8Array, nodeId }`
candidates for the buyer's manifest-verification pipeline.

## Parameters

### config

[`PurchaseLookupAdapterConfig`](../interfaces/PurchaseLookupAdapterConfig.md)

## Returns

`object`

### query()

> **query**(`params`): `Promise`\<`EdgeOperationResult`\<\{ `results`: `object`[]; \}\>\>

#### Parameters

##### params

###### provider?

`string`

###### resource

`string`

#### Returns

`Promise`\<`EdgeOperationResult`\<\{ `results`: `object`[]; \}\>\>
