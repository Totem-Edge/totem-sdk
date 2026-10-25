[**@totemsdk/omnia-factory**](../index.md)

***

[@totemsdk/omnia-factory](../index.md) / factoryBalanceSetRoot

# Function: factoryBalanceSetRoot()

> **factoryBalanceSetRoot**(`participants`): `object`

Balance set-root (RFC-048 §12.4) — the MMR root over `(pubkey, balance)` leaves,
where each participant's `contributionAmount` is the **leaf sum**. This commits
the exact distribution of the factory balance (`rootSum` = the total) and is the
scalable, off-chain commitment that replaces per-party balance ports.

## Parameters

### participants

[`FactoryParticipant`](../interfaces/FactoryParticipant.md)[]

## Returns

`object`

### root

> **root**: `string`

### rootSum

> **rootSum**: `bigint`
