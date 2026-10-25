[**@totemsdk/eefi**](../index.md)

***

[@totemsdk/eefi](../index.md) / EefiRiskPolicyRef

# Interface: EefiRiskPolicyRef

A declarative risk policy referenced by products. `policyId` is the canonical
digest of the policy body excluding `policyId` (see `eefiRiskPolicyId`).
This is never a discretionary engine.

## Properties

### collateralRatioBps?

> `optional` **collateralRatioBps?**: `number`

***

### haircutBps?

> `optional` **haircutBps?**: `number`

***

### liquidationConditionId?

> `optional` **liquidationConditionId?**: `string`

***

### maxExposureAtoms

> **maxExposureAtoms**: `string`

***

### oraclePolicyIds?

> `optional` **oraclePolicyIds?**: `string`[]

***

### policyId

> **policyId**: `string`

***

### version

> **version**: `"eefi-risk/v1"`
