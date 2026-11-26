[**@totemsdk/tx-builder**](../index.md)

***

[@totemsdk/tx-builder](../index.md) / buildHtlcClaim

# Function: buildHtlcClaim()

> **buildHtlcClaim**(`params`): [`EnhancedBuildParams`](../interfaces/EnhancedBuildParams.md)

Build the claim transaction parameters. The HTLC input descriptor contains
the claim script but no state variables; the preimage is transaction state
port 1 as raw hex.

## Parameters

### params

[`BuildHtlcClaimParams`](../interfaces/BuildHtlcClaimParams.md)

## Returns

[`EnhancedBuildParams`](../interfaces/EnhancedBuildParams.md)
