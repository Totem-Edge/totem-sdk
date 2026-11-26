[**@totemsdk/vtxo**](../index.md)

***

[@totemsdk/vtxo](../index.md) / checkPoolFunding

# Function: checkPoolFunding()

> **checkPoolFunding**(`coinId`, `expected`, `chainProvider`, `options?`): `Promise`\<[`PoolFundingCheck`](../interfaces/PoolFundingCheck.md)\>

Check that the pool's on-chain coin exists, matches the expected
(address, amount, token), is unspent, and that the node serves an MMR proof.

NOTE: this is a **presence/shape check**, not a cryptographic proof
verification, unless a `verifyProof` callback is supplied — see
`PoolFundingCheck.proofVerified`.

## Parameters

### coinId

`string`

### expected

[`PoolFundingExpectation`](../interfaces/PoolFundingExpectation.md)

### chainProvider

`ChainStateProvider`

### options?

#### requireVerified?

`boolean`

Fail closed unless the MMR proof verifies.

#### verifyProof?

(`proof`, `coinId`) => `boolean`

## Returns

`Promise`\<[`PoolFundingCheck`](../interfaces/PoolFundingCheck.md)\>
