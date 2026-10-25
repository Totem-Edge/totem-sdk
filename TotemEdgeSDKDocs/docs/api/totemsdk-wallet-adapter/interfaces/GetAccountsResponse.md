[**@totemsdk/wallet-adapter**](../index.md)

***

[@totemsdk/wallet-adapter](../index.md) / GetAccountsResponse

# Interface: GetAccountsResponse

Internal/subclass account shape. `TOTEM_GET_ACCOUNTS` is normalised on the
wire to the canonical connect shape (`{ accounts: [{ index, address, balance }] }`).

## Properties

### accounts

> **accounts**: [`AccountEntry`](AccountEntry.md)[]

***

### activeIndex

> **activeIndex**: `number`
