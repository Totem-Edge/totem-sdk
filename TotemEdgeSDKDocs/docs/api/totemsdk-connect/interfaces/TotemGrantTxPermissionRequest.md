[**@totemsdk/connect**](../index.md)

***

[@totemsdk/connect](../index.md) / TotemGrantTxPermissionRequest

# Interface: TotemGrantTxPermissionRequest

## Properties

### method

> **method**: `"TOTEM_GRANT_TX_PERMISSION"`

***

### params

> **params**: `object`

#### config

> **config**: `object`

##### config.allowedIntents?

> `optional` **allowedIntents?**: [`DAppTransactionIntent`](../type-aliases/DAppTransactionIntent.md)[]

##### config.expiresInDays?

> `optional` **expiresInDays?**: `number`

##### config.tokenLimits?

> `optional` **tokenLimits?**: [`TokenSpendingLimit`](TokenSpendingLimit.md)[]

#### origin

> **origin**: `string`
