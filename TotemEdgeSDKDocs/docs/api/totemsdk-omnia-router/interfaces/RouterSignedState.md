[**@totemsdk/omnia-router**](../index.md)

***

[@totemsdk/omnia-router](../index.md) / RouterSignedState

# Interface: RouterSignedState

A channel state the router can reason about without depending on `omnia`
(OMN-083). Only the fields the fee proof binds are modelled.

## Properties

### balances

> **balances**: `Record`\<`string`, `bigint`\>

***

### pendingHTLCs?

> `optional` **pendingHTLCs?**: `object`[]

#### amount

> **amount**: `bigint`

#### htlcId

> **htlcId**: `string`

#### recipientPublicKeyDigest?

> `optional` **recipientPublicKeyDigest?**: `string`

#### status?

> `optional` **status?**: `string`

***

### sequence

> **sequence**: `number`

***

### signatures?

> `optional` **signatures?**: `Record`\<`string`, `unknown`\>

***

### stateVariables?

> `optional` **stateVariables?**: `object`[]

#### port

> **port**: `number`

#### value

> **value**: `unknown`
