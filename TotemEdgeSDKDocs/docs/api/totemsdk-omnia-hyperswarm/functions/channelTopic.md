[**@totemsdk/omnia-hyperswarm**](../index.md)

***

[@totemsdk/omnia-hyperswarm](../index.md) / channelTopic

# Function: channelTopic()

> **channelTopic**(`channelId`): `Buffer`

Derive the 32-byte Hyperswarm topic Buffer for a given channel ID.

## Parameters

### channelId

`string`

Omnia channel identifier (hex string or any stable ID).

## Returns

`Buffer`

32-byte Buffer suitable as a Hyperswarm `swarm.join(topic)` argument.
