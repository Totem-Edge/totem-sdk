[**@totemsdk/liquidity-bond**](../index.md)

***

[@totemsdk/liquidity-bond](../index.md) / RegisterSettledFeePayoutParams

# Interface: RegisterSettledFeePayoutParams

## Properties

### amount

> **amount**: `bigint`

Amount actually paid to the LP, in atoms.

***

### payoutRef

> **payoutRef**: [`FeePayoutRef`](FeePayoutRef.md)

***

### poolId

> **poolId**: `string`

***

### positionId

> **positionId**: `string`

***

### settlement

> **settlement**: [`PayoutSettlementEvidence`](PayoutSettlementEvidence.md)

***

### verifier

> **verifier**: [`PayoutSettlementVerifier`](PayoutSettlementVerifier.md)

Required: verifies the settlement against a real evidence source. Absent or
failing verification means the payout is never recorded (fail closed).
