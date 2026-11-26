[**@totemsdk/tx-builder**](../index.md)

***

[@totemsdk/tx-builder](../index.md) / buildHtlcFundingOutput

# Function: buildHtlcFundingOutput()

> **buildHtlcFundingOutput**(`parties`, `amount`, `tokenId?`): `object`

Build the HTLC funding output (the script address the maker/taker funds).
Funding is a normal output to the HTLC address; the script itself is carried
by the input descriptors when the coin is later claimed/refunded.

## Parameters

### parties

[`HtlcParties`](../interfaces/HtlcParties.md)

### amount

`string`

### tokenId?

`string`

## Returns

`object`

### address

> **address**: `string`

### output

> **output**: [`EnhancedCoinOutput`](../interfaces/EnhancedCoinOutput.md)

### script

> **script**: `string` = `htlc.script`
