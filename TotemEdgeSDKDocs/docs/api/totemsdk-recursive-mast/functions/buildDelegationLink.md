[**@totemsdk/recursive-mast**](../index.md)

***

[@totemsdk/recursive-mast](../index.md) / buildDelegationLink

# Function: buildDelegationLink()

> **buildDelegationLink**(`delegator`, `delegate`, `policyRoot`, `proof`, `constraints?`, `sequence?`): `DelegationLink`

Build a single delegation link.

## Parameters

### delegator

`string`

The delegator's public key digest.

### delegate

`string`

The delegate's public key digest.

### policyRoot

`string`

The policy root authorizing this delegation.

### proof

`string`

Merkle proof that the delegation script is in the policy root.

### constraints?

`DelegationConstraints` = `{}`

Constraints on the delegation.

### sequence?

`number` = `0`

Sequence number in the chain.

## Returns

`DelegationLink`
