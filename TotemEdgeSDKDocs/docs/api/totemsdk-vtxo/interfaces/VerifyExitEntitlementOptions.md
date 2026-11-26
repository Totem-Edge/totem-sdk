[**@totemsdk/vtxo**](../index.md)

***

[@totemsdk/vtxo](../index.md) / VerifyExitEntitlementOptions

# Interface: VerifyExitEntitlementOptions

OMN-025: witness verification needs the signing key material, which an
entitlement cannot carry. Callers therefore supply a verifier; without one,
an untrusted entitlement is rejected rather than accepted on shape alone.

## Properties

### pool?

> `optional` **pool?**: [`OmniaVtxoPool`](OmniaVtxoPool.md)

Authoritative pool (live or historical) the exit must spend.

***

### requireWitness?

> `optional` **requireWitness?**: `boolean`

Set to false only when the caller produced the entitlement itself. Default
is true: an unverified witness invalidates the entitlement.

***

### verifyWitness?

> `optional` **verifyWitness?**: (`witness`, `digest`, `entitlement`) => `boolean`

Verify the serialized witness over the exit digest.

#### Parameters

##### witness

`Uint8Array`

##### digest

`Uint8Array`

##### entitlement

[`VtxoExitEntitlement`](VtxoExitEntitlement.md)

#### Returns

`boolean`
