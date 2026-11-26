[**@totemsdk/tx-builder**](../index.md)

***

[@totemsdk/tx-builder](../index.md) / BuildHtlcClaimParams

# Interface: BuildHtlcClaimParams

## Properties

### claimerAddress

> **claimerAddress**: `string`

Address that receives the claimed amount.

***

### claimerPublicKey

> **claimerPublicKey**: `string`

Public key that signs the claim (recipient).

***

### fee

> **fee**: [`HtlcCoinRef`](HtlcCoinRef.md)

The fee/change coin owned by the claimer.

***

### feeChangeAddress

> **feeChangeAddress**: `string`

Address that receives the fee change.

***

### funding

> **funding**: [`HtlcCoinRef`](HtlcCoinRef.md)

The funded HTLC coin being claimed.

***

### parties

> **parties**: [`HtlcParties`](HtlcParties.md)

***

### preimage

> **preimage**: `string`

The 32-byte preimage (hex).
