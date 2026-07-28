[**@totemsdk/recursive-mast**](../index.md)

***

[@totemsdk/recursive-mast](../index.md) / verifyDelegationChain

# Function: verifyDelegationChain()

> **verifyDelegationChain**(`chain`): `object`

Verify a delegation chain. Each link must:
1. Have a valid Merkle proof (delegation script is in policyRoot)
2. Chain continuity: each link's delegator must be the previous link's delegate
3. Constraints must be satisfied

## Parameters

### chain

`DelegationChain`

## Returns

`object`

### reason?

> `optional` **reason?**: `string`

### valid

> **valid**: `boolean`
