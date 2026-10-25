[**@totemsdk/connect**](../index.md)

***

[@totemsdk/connect](../index.md) / TotemSendTransactionRequest

# Interface: TotemSendTransactionRequest

## Properties

### method

> **method**: `"TOTEM_SEND_TRANSACTION"`

***

### params

> **params**: `object`

#### origin

> **origin**: `string`

#### request

> **request**: `object`

##### request.intent?

> `optional` **intent?**: [`DAppTransactionIntent`](../type-aliases/DAppTransactionIntent.md)

##### request.outputs

> **outputs**: `object`[]

##### request.transactionState?

> `optional` **transactionState?**: [`StateVariable`](StateVariable.md)[]

Transaction-level state variables.

##### request.version

> **version**: `1`
