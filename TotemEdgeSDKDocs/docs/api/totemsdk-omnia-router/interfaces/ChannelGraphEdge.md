[**@totemsdk/omnia-router**](../index.md)

***

[@totemsdk/omnia-router](../index.md) / ChannelGraphEdge

# Interface: ChannelGraphEdge

A directed edge in the channel graph.
For a bidirectional channel, add two edges (one per direction).

## Properties

### availableBalance

> **availableBalance**: `bigint`

Sender's available balance in scaled units

***

### channelId

> **channelId**: `string`

***

### feeRate

> **feeRate**: `bigint`

Fee per SCALE units of amount (e.g. 100_000n = 0.1%)

***

### from

> **from**: `string`

Sender's public key digest

***

### htlcCapacity

> **htlcCapacity**: `bigint`

Maximum additional HTLC capacity in scaled units

***

### to

> **to**: `string`

Recipient's public key digest

***

### tokenId

> **tokenId**: `string`
