[**@totemsdk/raster-proof**](../index.md)

***

[@totemsdk/raster-proof](../index.md) / chunkBytes

# Function: chunkBytes()

> **chunkBytes**(`bytes`, `chunkSizeBytes?`): [`RasterChunk`](../interfaces/RasterChunk.md)[]

Split bytes into fixed-size chunks (default 64 KiB). Each chunk carries a
content hash of its raw bytes. Empty input is rejected.

## Parameters

### bytes

`Uint8Array`

### chunkSizeBytes?

`number` = `DEFAULT_CHUNK_SIZE_BYTES`

## Returns

[`RasterChunk`](../interfaces/RasterChunk.md)[]
