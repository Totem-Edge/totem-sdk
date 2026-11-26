[**@totemsdk/liquidity-bond**](../index.md)

***

[@totemsdk/liquidity-bond](../index.md) / SettledFeePayout

# Interface: SettledFeePayout

A payout that a verifier confirmed as settled, recorded in the registry so a
fee claim/compound can consume it. Single-use: `consumedBy` is set by the fee
record that released the entitlement.

## Extends

- [`FeePayoutRef`](FeePayoutRef.md)

## Properties

### amount

> **amount**: `bigint`

Amount actually paid to the LP, in atoms.

***

### consumedAt?

> `optional` **consumedAt?**: `number`

***

### consumedBy?

> `optional` **consumedBy?**: `string`

Fee record id that consumed this payout (a settled payout is single-use).

***

### evidenceRef

> **evidenceRef**: `string`

Evidence reference that proved the payout settled.

***

### kind

> **kind**: `"vtxo-mint"` \| `"channel-settlement"` \| `"external"`

#### Inherited from

[`FeePayoutRef`](FeePayoutRef.md).[`kind`](FeePayoutRef.md#kind)

***

### nonce

> **nonce**: `string`

#### Inherited from

[`FeePayoutRef`](FeePayoutRef.md).[`nonce`](FeePayoutRef.md#nonce)

***

### payoutId

> **payoutId**: `string`

#### Inherited from

[`FeePayoutRef`](FeePayoutRef.md).[`payoutId`](FeePayoutRef.md#payoutid)

***

### poolId

> **poolId**: `string`

***

### positionId

> **positionId**: `string`

***

### settledAt

> **settledAt**: `number`

***

### settlementStatus

> **settlementStatus**: [`PayoutSettlementStatus`](../type-aliases/PayoutSettlementStatus.md)
