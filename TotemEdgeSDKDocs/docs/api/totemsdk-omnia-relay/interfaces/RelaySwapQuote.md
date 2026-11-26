[**@totemsdk/omnia-relay**](../index.md)

***

[@totemsdk/omnia-relay](../index.md) / RelaySwapQuote

# Interface: RelaySwapQuote

An authenticated cross-token swap quote (OMN-085).

Comparing amounts across different assets is not an economic check: 100 of
token A and 100 of token B are unrelated. A cross-asset forward therefore
needs an explicit, signed deal — the exact assets and amounts, an expiry, and
a signature the intermediary can verify.

## Properties

### amountIn

> **amountIn**: `bigint`

Amount of `tokenIn` the intermediary takes in.

***

### amountOut

> **amountOut**: `bigint`

Amount of `tokenOut` it pays out.

***

### expiresAt

> **expiresAt**: `number`

Unix epoch ms after which the quote is void.

***

### maxSlippageBps?

> `optional` **maxSlippageBps?**: `number`

Tolerated slippage against the quoted rate, in basis points.

***

### quotedBy?

> `optional` **quotedBy?**: `string`

Party that issued the quote (identity, not necessarily the peer).

***

### signature

> **signature**: `string`

Serialized signature over the canonical quote payload.

***

### tokenIn

> **tokenIn**: `string`

***

### tokenOut

> **tokenOut**: `string`
