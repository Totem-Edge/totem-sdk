[**@totemsdk/recursive-mast**](../index.md)

***

[@totemsdk/recursive-mast](../index.md) / buildCrossDomainBridge

# Function: buildCrossDomainBridge()

> **buildCrossDomainBridge**(`sourceDomain`, `targetDomain`, `sourcePolicyRoot`, `targetPolicyRoot`, `acceptanceProof`, `constraints?`): `CrossDomainBridge`

Build a cross-domain trust bridge.

## Parameters

### sourceDomain

`string`

Source domain identifier.

### targetDomain

`string`

Target domain identifier.

### sourcePolicyRoot

`string`

The policy root in the source domain that accepts target proofs.

### targetPolicyRoot

`string`

The policy root in the target domain being accepted.

### acceptanceProof

`string`

Merkle proof that the acceptance script is in the source policy root.

### constraints?

`CrossDomainConstraints` = `{}`

Constraints on accepted proofs.

## Returns

`CrossDomainBridge`
