[**@totemsdk/statechain**](../index.md)

***

[@totemsdk/statechain](../index.md) / claimOwnership

# Function: claimOwnership()

> **claimOwnership**(`chain`, `leaseProvider`): `Promise`\<[`ClaimPayload`](../interfaces/ClaimPayload.md)\>

Cooperative claim — current owner + SE co-sign a claim TX.

Public API: `claimOwnership(chain, leaseProvider) -> ClaimPayload`

Both `chain.currentOwner.sign` and `leaseProvider.seClient.blindSign` sign
`computeTransactionDigest(tx)` — the actual TX body hash — satisfying the
`MULTISIG(2 STATE(0) SE)` spending path. No timelock required.

## Parameters

### chain

[`StateChain`](../interfaces/StateChain.md)

Active or claiming statechain.

### leaseProvider

[`StatechainLeaseProvider`](../interfaces/StatechainLeaseProvider.md)

Bundle: SE client for countersigning + optional broadcast.

## Returns

`Promise`\<[`ClaimPayload`](../interfaces/ClaimPayload.md)\>

ClaimPayload with txHex, claimAddress, chainId, coinId, and optional txpowId.
