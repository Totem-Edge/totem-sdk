[**@totemsdk/replication-holepunch**](../index.md)

***

[@totemsdk/replication-holepunch](../index.md) / downloadModelAsset

# Function: downloadModelAsset()

> **downloadModelAsset**(`options`): `Promise`\<[`DownloadedModelAsset`](../interfaces/DownloadedModelAsset.md)\>

Download, verify, then publish a model asset. Verification happens before
`store.put`, so an interrupted or tampered download leaves the store
unchanged.

## Parameters

### options

[`DownloadModelAssetOptions`](../interfaces/DownloadModelAssetOptions.md)

## Returns

`Promise`\<[`DownloadedModelAsset`](../interfaces/DownloadedModelAsset.md)\>
