[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / htlcTransitionEligibility

# Function: htlcTransitionEligibility()

> **htlcTransitionEligibility**(`htlc`, `currentBlock`): `"claim"` \| `"refund"`

Canonical HTLC transition boundary (OMN-093).

The deployed program validates a refund when `currentBlock >= timeoutBlock`
(`program.ts`, `validateTransition` → `'htlc timeout block not reached'`).
At the exact timeout block, therefore, only the **refund** path is valid and
a fulfil must already be refused. This predicate is the single place that
decision is made.

## Parameters

### htlc

`Pick`\<[`HTLCRecord`](../interfaces/HTLCRecord.md), `"timeoutBlock"`\>

### currentBlock

`bigint`

## Returns

`"claim"` \| `"refund"`
