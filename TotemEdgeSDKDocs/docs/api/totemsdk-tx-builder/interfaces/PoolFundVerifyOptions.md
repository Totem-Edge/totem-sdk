[**@totemsdk/tx-builder**](../index.md)

***

[@totemsdk/tx-builder](../index.md) / PoolFundVerifyOptions

# Interface: PoolFundVerifyOptions

RFC-020 P2-11: acceptance-time replay/expiry inputs.

## Properties

### now?

> `optional` **now?**: `number`

Current time (epoch ms) for expiry evaluation. Defaults to `Date.now()`.

***

### seenNonces?

> `optional` **seenNonces?**: `ReadonlySet`\<`string`\>

Replay guard. Acceptance MUST pass the set of nonces already consumed (or an
on-chain spent check); a nonce present here is rejected.
