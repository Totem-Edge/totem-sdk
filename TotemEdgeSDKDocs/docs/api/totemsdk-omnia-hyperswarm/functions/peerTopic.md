[**@totemsdk/omnia-hyperswarm**](../index.md)

***

[@totemsdk/omnia-hyperswarm](../index.md) / peerTopic

# Function: peerTopic()

> **peerTopic**(`pubkey`): `Buffer`

Derive a 32-byte Hyperswarm topic Buffer for peer-to-peer rendezvous.
Used by `connectToPeer(pubkey)` to join the same topic as the target peer.

## Parameters

### pubkey

`string`

Hex-encoded 32-byte peer public key.

## Returns

`Buffer`
