[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / programAmountState

# Function: programAmountState()

> **programAmountState**(`port`, `value`): [`StateValue`](../interfaces/StateValue.md)

A number state value that carries a MINIMA/token amount. It is stored in
atoms like every other Omnia amount, but serialized with scale 44 so a
KISSVM `STATE(port)` comparison against `AMOUNT` sees the same decimal.

## Parameters

### port

`number`

### value

`bigint`

## Returns

[`StateValue`](../interfaces/StateValue.md)
