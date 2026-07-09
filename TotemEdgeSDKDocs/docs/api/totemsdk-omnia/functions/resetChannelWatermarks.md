[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / \_resetChannelWatermarks

# Function: \_resetChannelWatermarks()

> **\_resetChannelWatermarks**(): `void`

Reset all channel sequence watermarks.
Intended only for test isolation — call in `beforeEach` to prevent watermarks
from bleeding between tests that share a fixed `channelId`.

## Returns

`void`
