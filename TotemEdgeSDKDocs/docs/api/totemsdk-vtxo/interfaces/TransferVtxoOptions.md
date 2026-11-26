[**@totemsdk/vtxo**](../index.md)

***

[@totemsdk/vtxo](../index.md) / TransferVtxoOptions

# Interface: TransferVtxoOptions

OMN-025: an entitlement supplied by a peer must carry a witness the caller can
verify. Set `allowUnverifiedExit` only for entitlements this process built.

## Properties

### allowUnverifiedExit?

> `optional` **allowUnverifiedExit?**: `boolean`

***

### verifyExitWitness?

> `optional` **verifyExitWitness?**: (`witness`, `digest`, `entitlement`) => `boolean`

#### Parameters

##### witness

`Uint8Array`

##### digest

`Uint8Array`

##### entitlement

[`VtxoExitEntitlement`](VtxoExitEntitlement.md)

#### Returns

`boolean`
