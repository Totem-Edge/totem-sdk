[**@totemsdk/omnia-router**](../index.md)

***

[@totemsdk/omnia-router](../index.md) / ForwardHop

# Interface: ForwardHop

Onward instruction the forwarder peels from an envelope.

## Properties

### amount

> **amount**: `bigint`

***

### channelId?

> `optional` **channelId?**: `string`

Optional explicit outgoing channel id (else the forwarder finds its channel to `via`).

***

### timeoutBlock?

> `optional` **timeoutBlock?**: `bigint`

Absolute timeout (block) for the outgoing HTLC, when the envelope carries one.

***

### tokenId

> **tokenId**: `string`

***

### via

> **via**: `string`

Next-hop party public-key digest (the immediate recipient of the outgoing HTLC).
