[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / AccountedPurchaseAuthorityOptions

# Interface: AccountedPurchaseAuthorityOptions

## Properties

### grantBound

> **grantBound**: `GrantBoundPolicy`

Reused agent-policy authority+accounting owner: mandate scope/usage check + atomic reserve.

***

### now?

> `optional` **now?**: () => `number`

Injectable clock (defaults to `Date.now`).

#### Returns

`number`

***

### run

> **run**: `AutonomousRun`

Run context this purchase stream draws from (`runId`, `principal`, `grantProofIds`).

***

### stepFor?

> `optional` **stepFor?**: (`params`) => `AgentStep`

Derive the step to authorize for an agreement. Default: one
`purchase.pay` step per agreement, targeted at the seller.

#### Parameters

##### params

###### agreement

[`TradeAgreement`](TradeAgreement.md)

###### intent

[`PurchaseIntent`](PurchaseIntent.md)

#### Returns

`AgentStep`

***

### usageStore

> **usageStore**: `GrantUsageStore`

The SAME `GrantUsageStore` the policy reserves against. Used for counters
and conservative crash recovery only — never as a second accounting layer.
