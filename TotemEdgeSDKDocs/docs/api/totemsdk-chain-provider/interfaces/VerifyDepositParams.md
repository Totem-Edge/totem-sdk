[**@totemsdk/chain-provider**](../index.md)

***

[@totemsdk/chain-provider](../index.md) / VerifyDepositParams

# Interface: VerifyDepositParams

Inputs for a live deposit-funding check. "Verified" here means a check against
on-chain truth (unspent coin owned by the LP for the claimed token+amount) —
never a declared string on a record.

## Properties

### claimedAmount?

> `optional` **claimedAmount?**: `string`

Claimed funding amount (decimal string); coin.amount must be >= this.

***

### coinId

> **coinId**: `string`

Coin spendable as the funding source.

***

### ownerAddress

> **ownerAddress**: `string`

Address that must own the coin (Mx form; 0x-hex roots are normalized against).

***

### requireConfirmed?

> `optional` **requireConfirmed?**: `boolean`

When true, only chain-confirmed coins pass (mmrentry != '0').

***

### tokenId?

> `optional` **tokenId?**: `string`

Required token ID; omit to accept base MINIMA.
