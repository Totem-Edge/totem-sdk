[**@totemsdk/omnia-splice**](../index.md)

***

[@totemsdk/omnia-splice](../index.md) / PendingSpliceRecord

# Interface: PendingSpliceRecord

Durable record written before broadcast so a restart can reconcile.

## Properties

### broadcastAt

> **broadcastAt**: `number`

***

### channelId

> **channelId**: `string`

***

### coinId?

> `optional` **coinId?**: `string`

***

### expected?

> `optional` **expected?**: `object`

OMN-014: the successor this splice must produce. Recovery uses the record's
own address/token/amount (and coin id once observed) instead of applying one
global observation to every pending splice.

#### address

> **address**: `string`

#### amount

> **amount**: `string`

#### tokenId

> **tokenId**: `string`

***

### spliceId

> **spliceId**: `string`

***

### txHex

> **txHex**: `string`

***

### txpowId

> **txpowId**: `string`
