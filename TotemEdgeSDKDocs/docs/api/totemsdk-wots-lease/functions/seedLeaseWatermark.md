[**@totemsdk/wots-lease**](../index.md)

***

[@totemsdk/wots-lease](../index.md) / seedLeaseWatermark

# Function: seedLeaseWatermark()

> **seedLeaseWatermark**(`params`): `Promise`\<[`LocalWatermark`](../interfaces/LocalWatermark.md)\>

Seed a local watermark from the best available source, requiring at least one
source unless `fresh` is set. Returns the resulting local watermark.

## Parameters

### params

[`SeedLeaseWatermarkParams`](../interfaces/SeedLeaseWatermarkParams.md)

## Returns

`Promise`\<[`LocalWatermark`](../interfaces/LocalWatermark.md)\>

## Throws

when no source is available and the
  keyspace is not declared fresh.

## Throws

when a supplied seed is behind the
  current cursor.
