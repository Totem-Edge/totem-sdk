[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / CollateralBondConfig

# Interface: CollateralBondConfig

OMP-21 — enforceable collateral bond (RFC-048 §2, RFC-050 §4/§6).

A collateral bond turns a *promise* of slashing into an *enforced* covenant.
The RFC-048 invariant is explicit: liquidation MUST be triggered by an
**objective, on-chain-verifiable condition** and executed by covenant — never
by an operator's say-so (RFC-050 §6). The same template gives the borrower an
operator-independent reclaim path so the bond is never custodial.

Branches:
  1. **Repayment release** — when `releaseCondition` holds (default: the lender
     signs), the collateral returns to the borrower.
  2. **Post-maturity settlement** — after the committed maturity block the
     outcome is fully determined by `liquidationCondition`: defaulted → the
     lender seizes; not defaulted → the borrower reclaims. Because the branch is
     decided by the objective condition, a defaulting borrower cannot race the
     lender by reclaiming first.
  3. **Pre-maturity default** — before maturity, an objective default lets the
     lender seize (permissionless; payout fixed to the lender).

The lender can never pay itself except through the objective condition, and the
borrower always has a timelocked reclaim when no default is proven.

## Properties

### borrower

> **borrower**: `string`

Borrower identity / reclaim destination (WOTS public-key digest, hex).

***

### lender

> **lender**: `string`

Lender identity / seizure destination (hex).

***

### liquidationCondition

> **liquidationCondition**: `string`

Objective, on-chain-verifiable default condition (KISSVM boolean expression),
e.g. `MAST(0x<oracleRoot>)`, `@BLOCK GTE 500000`. Required — liquidation
without an objective condition is discretionary and MUST NOT be used.

***

### maturityPort?

> `optional` **maturityPort?**: `number`

State port carrying the absolute maturity block. Default 100.

***

### releaseCondition?

> `optional` **releaseCondition?**: `string`

Condition under which the collateral is released to the borrower after
repayment. Defaults to `SIGNEDBY(<lender>)`.

***

### tokenId?

> `optional` **tokenId?**: `string`

Asset id (hex). Defaults to `0x00` (MINIMA).
