[**@totemsdk/omnia-router**](../index.md)

***

[@totemsdk/omnia-router](../index.md) / buildRouterFeeProof

# Function: buildRouterFeeProof()

> **buildRouterFeeProof**(`channel`, `htlc`, `settledAt?`): [`RouterFeeProof`](../interfaces/RouterFeeProof.md)

Build a verifiable fee-provenance record for a settled hop (#29). The pool's
`recordPoolFee` earn-proof consumes this — a fee record can be traced to a
real fulfilled payment, never a declared string.

## Parameters

### channel

[`RouterChannel`](../interfaces/RouterChannel.md)

### htlc

[`ChannelHTLC`](../interfaces/ChannelHTLC.md)

### settledAt?

`number`

## Returns

[`RouterFeeProof`](../interfaces/RouterFeeProof.md)
