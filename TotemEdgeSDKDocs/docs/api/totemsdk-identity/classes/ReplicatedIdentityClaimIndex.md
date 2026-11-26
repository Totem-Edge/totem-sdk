[**@totemsdk/identity**](../index.md)

***

[@totemsdk/identity](../index.md) / ReplicatedIdentityClaimIndex

# Class: ReplicatedIdentityClaimIndex

## Constructors

### Constructor

> **new ReplicatedIdentityClaimIndex**(`index`): `ReplicatedIdentityClaimIndex`

#### Parameters

##### index

[`IdentityIndexPort`](../interfaces/IdentityIndexPort.md)

#### Returns

`ReplicatedIdentityClaimIndex`

## Methods

### claimsFor()

> **claimsFor**(`subject`): `Promise`\<[`SignedIdentityClaim`](../interfaces/SignedIdentityClaim.md)[]\>

#### Parameters

##### subject

`string`

#### Returns

`Promise`\<[`SignedIdentityClaim`](../interfaces/SignedIdentityClaim.md)[]\>

***

### putClaim()

> **putClaim**(`signed`): `Promise`\<`boolean`\>

#### Parameters

##### signed

[`SignedIdentityClaim`](../interfaces/SignedIdentityClaim.md)

#### Returns

`Promise`\<`boolean`\>
