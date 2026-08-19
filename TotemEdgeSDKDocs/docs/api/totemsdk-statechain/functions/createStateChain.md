[**@totemsdk/statechain**](../index.md)

***

[@totemsdk/statechain](../index.md) / createStateChain

# Function: createStateChain()

> **createStateChain**(`coinId`, `owner`, `sePublicKey`, `leaseProvider`, `chainProvider?`): `Promise`\<[`StateChain`](../interfaces/StateChain.md)\>

Create a new StateChain by locking a coin into the statechain MULTISIG script.

Public API: `createStateChain(coinId, owner, sePublicKey, leaseProvider, chainProvider?)`

Steps:
 1. Resolve coin details (address, tokenId, amount) from owner fields or chainProvider.
 2. Build the STATE(0)-based locking script and compute lockingAddress.
 3. Build and sign the LOCK TX: moves `coinId` into `lockingAddress` with
    STATE(0) = ownerPkd. Output coinId becomes `chain.coinId`.
 4. Broadcast the lock TX if `leaseProvider.broadcast` is present.
 5. Register the locked coin with the SE via `seClient.registerChain?`.
 6. Pre-sign the initial owner's unilateral reclaim TX (owner can exit
    without SE after

## Parameters

### coinId

`string`

The input UTXO coinId to be locked into the statechain.
                        `chain.coinId` will be the LOCK TX output coinId (different).

### owner

[`StatechainOwner`](../interfaces/StatechainOwner.md)

Initial owner with identity, signing capability, and coin metadata.
                        `owner.address`, `owner.tokenId`, `owner.amount` must be present
                        (or derivable from `chainProvider`).

### sePublicKey

`string`

SE's WOTS public key digest.

### leaseProvider

[`StatechainLeaseProvider`](../interfaces/StatechainLeaseProvider.md)

SE client + optional broadcast for the lock TX.

### chainProvider?

`ChainStateProvider`

Optional: fetch coin details when owner metadata is absent.

## Returns

`Promise`\<[`StateChain`](../interfaces/StateChain.md)\>

## COINAGE

>= reclaimTimelock).
