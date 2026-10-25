[**@totemsdk/tx-builder**](../index.md)

***

[@totemsdk/tx-builder](../index.md) / SpendableCoin

# Interface: SpendableCoin

## Properties

### address

> **address**: `string`

***

### amount

> **amount**: `string`

***

### coinId

> **coinId**: `string`

***

### created

> **created**: `number`

***

### expiresAt?

> `optional` **expiresAt?**: `number`

RFC-020 P2-12: absolute expiry (epoch ms); expired coins must not be selected.

***

### spent?

> `optional` **spent?**: `boolean`

RFC-020 P2-12: when true the coin is already spent and must not be selected.

***

### tokenid

> **tokenid**: `string`
