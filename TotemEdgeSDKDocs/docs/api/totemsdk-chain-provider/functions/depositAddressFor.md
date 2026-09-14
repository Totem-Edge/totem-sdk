[**@totemsdk/chain-provider**](../index.md)

***

[@totemsdk/chain-provider](../index.md) / depositAddressFor

# Function: depositAddressFor()

> **depositAddressFor**(`lp`, `opts?`): `string`

Deterministic, domain-separated funding address for an LP deposit. In
production this is the channel/pool script address the LP pays into and the
funding check is run against; keeping it a pure derivation keeps issue #25
constructable and checkable without a live script compiler.

## Parameters

### lp

`string`

### opts?

[`DepositAddressOptions`](../interfaces/DepositAddressOptions.md)

## Returns

`string`
