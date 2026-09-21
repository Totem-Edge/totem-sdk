[**@totemsdk/omnia-router**](../index.md)

***

[@totemsdk/omnia-router](../index.md) / SettledSegment

# Interface: SettledSegment

A payment segment that has been irrevocably settled by preimage reveal.

## Properties

### channelId

> **channelId**: `string`

***

### htlcId

> **htlcId**: `string`

***

### preimage

> **preimage**: `string`

Preimage revealed during settlement — must survive a mid-route restart.

***

### recipientPublicKeyDigest?

> `optional` **recipientPublicKeyDigest?**: `string`

***

### reconciled?

> `optional` **reconciled?**: `boolean`

Set once a segment is fully reconciled against the node's route state.

***

### senderPublicKeyDigest?

> `optional` **senderPublicKeyDigest?**: `string`

***

### settledAt

> **settledAt**: `number`

Monotonic settlement timestamp.

***

### tokenId?

> `optional` **tokenId?**: `string`

Optional hop-level detail for reconciliation (amount, counterpart, digest).
