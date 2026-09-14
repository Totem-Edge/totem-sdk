[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / WorkRequired

# Interface: WorkRequired

A signed Edge protocol message wrapping a WorkChallenge.

WorkChallenge itself is intentionally unsigned generic TxPoW data. Edge
authenticates the challenge issuer by wrapping it in a signed message.

## Properties

### challenge

> **challenge**: `WorkChallenge`

***

### negotiationId

> **negotiationId**: `string`

***

### proposalId?

> `optional` **proposalId?**: `string`

***

### reason

> **reason**: `"initial-proposal"` \| `"counterproposal"` \| `"resource-admission"`

***

### recipient

> **recipient**: `string`

***

### sender

> **sender**: `string`

***

### signature

> **signature**: `string`

***

### signerPublicKey

> **signerPublicKey**: `string`

***

### version

> **version**: `number`
