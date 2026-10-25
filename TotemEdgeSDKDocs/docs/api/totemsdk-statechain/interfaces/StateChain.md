[**@totemsdk/statechain**](../index.md)

***

[@totemsdk/statechain](../index.md) / StateChain

# Interface: StateChain

StateChain — in-memory state of a Mercury-protocol statechain UTXO.

`lockingAddress` — same for all transfers (STATE(0) design).
`coinId`         — the CURRENT on-chain coin ID (updated per transfer hop).
  Starts as the LOCK TX output coin ID (not the original input coinId).
`reclaimTx`      — pre-signed unilateral reclaim TX for the CURRENT owner.
  Pre-built at createStateChain; rebuilt on every transferOwnership.
  Valid after

## COINAGE

>= reclaimTimelock without SE cooperation.
`reclaimAddress` — SIGNEDBY(currentOwnerPkd) output address of reclaimTx.

## Properties

### amount

> **amount**: `bigint`

***

### chainId

> **chainId**: `string`

***

### coinId

> **coinId**: `string`

***

### createdAt

> **createdAt**: `number`

***

### currentOwner

> **currentOwner**: [`StatechainOwner`](StatechainOwner.md)

***

### genesisCoinId?

> `optional` **genesisCoinId?**: `string`

The locked coin id at creation (the LOCK TX output spent by the first
transfer). Required to bind the first transfer's `txBodyHex` to its
ownership labels (AUD-012); absent on chains created before this field.

***

### lockingAddress

> **lockingAddress**: `string`

***

### lockingScript

> **lockingScript**: `string`

***

### reclaimAddress

> **reclaimAddress**: `string`

***

### reclaimTimelock

> **reclaimTimelock**: `number`

***

### reclaimTx

> **reclaimTx**: `string`

***

### seOwnershipProof?

> `optional` **seOwnershipProof?**: `SeOwnershipProof`

RFC-008: the SE's published identity — the root-identity `OwnershipProof`
that authorizes the leased child leaves used for transfer blind-signatures.
When present, `verifyStateChain` verifies leaf authorization against it.

***

### seProofVersion?

> `optional` **seProofVersion?**: `number`

RFC-008: monotonic SE identity-proof version.

***

### sePublicKey

> **sePublicKey**: `string`

***

### status

> **status**: [`StatechainStatus`](../type-aliases/StatechainStatus.md)

***

### tokenId

> **tokenId**: `string`

***

### transferHistory

> **transferHistory**: [`TransferRecord`](TransferRecord.md)[]
