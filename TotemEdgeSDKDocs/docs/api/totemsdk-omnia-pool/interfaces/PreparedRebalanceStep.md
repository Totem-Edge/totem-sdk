[**@totemsdk/omnia-pool**](../index.md)

***

[@totemsdk/omnia-pool](../index.md) / PreparedRebalanceStep

# Interface: PreparedRebalanceStep

A prepared rebalance step: the wallet-built tx draft + its canonical facts.

## Properties

### action

> **action**: `string`

***

### allocation?

> `optional` **allocation?**: `object`

The pool allocation mutation the rebalance performs.

#### params

> **params**: [`RebalanceAllocationParams`](../type-aliases/RebalanceAllocationParams.md)

#### position

> **position**: `LiquidityPosition`

#### registry

> **registry**: `LiquidityBondRegistryState`

***

### channelUpdate?

> `optional` **channelUpdate?**: [`RebalanceChannelUpdate`](RebalanceChannelUpdate.md)

The channel update the rebalance performs (for execution).

***

### draft?

> `optional` **draft?**: `OmniaTxDraft`

The Omnia tx draft the wallet built (or simulated). Optional for pure pool mutations.

***

### executionReceipt?

> `optional` **executionReceipt?**: `unknown`

***

### nonce

> **nonce**: `string`

***

### postconditionsVerified?

> `optional` **postconditionsVerified?**: `boolean`

***

### quoteTimestamp?

> `optional` **quoteTimestamp?**: `number`

***

### simulation?

> `optional` **simulation?**: `unknown`

Quote/simulation evidence captured by the wallet.

***

### stepId

> **stepId**: `string`
