[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / SignedChannelState

# Interface: SignedChannelState

## Properties

### balances

> **balances**: `Record`\<[`partyId`](../type-aliases/partyId.md), `bigint`\>

***

### pendingHTLCs

> **pendingHTLCs**: [`HTLCRecord`](HTLCRecord.md)[]

***

### sequence

> **sequence**: `number`

***

### signatures

> **signatures**: `Record`\<[`partyId`](../type-aliases/partyId.md), `ChannelSignature`\>

***

### signingIndices

> **signingIndices**: `Record`\<[`partyId`](../type-aliases/partyId.md), `SigningIndices`\>

***

### stateVariables

> **stateVariables**: [`StateValue`](StateValue.md)[]

***

### transactionHex

> **transactionHex**: `string`
