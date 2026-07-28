[**@totemsdk/realtime**](../index.md)

***

[@totemsdk/realtime](../index.md) / RawBalanceEntry

# Interface: RawBalanceEntry

Raw shape accepted by toPortfolioEntry().
All fields are optional — missing fields get safe defaults.

## Properties

### address?

> `optional` **address?**: `string`

***

### artimage?

> `optional` **artimage?**: `string`

***

### balance?

> `optional` **balance?**: `string`

alias used by some endpoints

***

### confirmed?

> `optional` **confirmed?**: `string`

***

### confirmed\_balance?

> `optional` **confirmed\_balance?**: `string`

alias used in some responses

***

### decimals?

> `optional` **decimals?**: `string` \| `number`

***

### name?

> `optional` **name?**: `string`

***

### sendable?

> `optional` **sendable?**: `string`

***

### ticker?

> `optional` **ticker?**: `string`

***

### token?

> `optional` **token?**: `string` \| \{ `artimage?`: `string`; `decimals?`: `string` \| `number`; `description?`: `string`; `name?`: `string`; `ticker?`: `string`; `webvalidate?`: `string`; \}

nested token metadata object

***

### token\_id?

> `optional` **token\_id?**: `string`

hex tokenid used by WS protocol

***

### tokenid?

> `optional` **tokenid?**: `string`

***

### total?

> `optional` **total?**: `string`

canonical total (confirmed + unconfirmed)

***

### unconfirmed?

> `optional` **unconfirmed?**: `string`

***

### unconfirmed\_balance?

> `optional` **unconfirmed\_balance?**: `string`

***

### webvalidate?

> `optional` **webvalidate?**: `string`
