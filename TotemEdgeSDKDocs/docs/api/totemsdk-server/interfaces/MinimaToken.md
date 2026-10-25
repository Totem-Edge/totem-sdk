[**@totemsdk/server**](../index.md)

***

[@totemsdk/server](../index.md) / MinimaToken

# Interface: MinimaToken

## Properties

### coinId

> **coinId**: `Uint8Array`

***

### created?

> `optional` **created?**: `bigint`

***

### name

> **name**: `Uint8Array`

***

### scale

> **scale**: `number`

***

### script

> **script**: `Uint8Array`

***

### totalAmount

> **totalAmount**: `bigint`

***

### totalAmountScale?

> `optional` **totalAmountScale?**: `number`

MiniNumber scale of `totalAmount` in the serialized Token. Minima's
`tokencreate` builds the minima amount from `MINI_UNIT` (1E-44) times
integers, so its scale is always 44; default accordingly.
