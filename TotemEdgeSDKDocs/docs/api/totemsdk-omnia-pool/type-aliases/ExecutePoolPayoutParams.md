[**@totemsdk/omnia-pool**](../index.md)

***

[@totemsdk/omnia-pool](../index.md) / ExecutePoolPayoutParams

# Type Alias: ExecutePoolPayoutParams

> **ExecutePoolPayoutParams** = `object`

## Properties

### ctx?

> `optional` **ctx?**: [`OmniaPoolAllocationContext`](../interfaces/OmniaPoolAllocationContext.md)

***

### intent

> **intent**: `WithdrawalIntent`

***

### pool

> **pool**: `LiquidityPoolManifest`

***

### position

> **position**: `LiquidityPosition`

***

### recipientAddress

> **recipientAddress**: `string`

***

### rooting?

> `optional` **rooting?**: [`RegistryRootingContext`](../interfaces/RegistryRootingContext.md)

***

### settlement?

> `optional` **settlement?**: [`PayoutFinality`](PayoutFinality.md)

Finality evidence (RFC-048 §3.3). A payout produces only a *draft* until a
verifiable settlement artifact is supplied; without `settlement` the intent
stays `approved` and the position is NOT decremented. `confirmed` and
`offchain-final` are distinct guarantees, both requiring a recovery policy.
