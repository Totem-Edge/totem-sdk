[**@totemsdk/eefi**](../index.md)

***

[@totemsdk/eefi](../index.md) / EefiExerciseCovenant

# Interface: EefiExerciseCovenant

Descriptor for the P-EXIT primitive (RFC-050 §3). The script itself is built
by `@totemsdk/kissvm` (`buildExerciseCovenant` / collateral / oracle
templates); this type only commits the condition and the exact payout paths.

## Properties

### beneficiaryPolicyHash

> **beneficiaryPolicyHash**: `string`

Hash of the exact beneficiary payout path(s).

***

### conditionId

> **conditionId**: `string`

Objective on-chain condition (maturity, timeout, oracle witness, default).

***

### kind

> **kind**: [`EefiExerciseKind`](../type-aliases/EefiExerciseKind.md)

***

### recoveryPolicyHash

> **recoveryPolicyHash**: `string`

Hash of the fallback / owner-reclaim policy.

***

### timelockBlocks

> **timelockBlocks**: `number`

***

### version

> **version**: `"eefi-exercise/v1"`
