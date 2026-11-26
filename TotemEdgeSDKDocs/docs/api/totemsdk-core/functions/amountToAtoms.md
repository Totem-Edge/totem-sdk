[**@totemsdk/core**](../index.md)

***

[@totemsdk/core](../index.md) / amountToAtoms

# Function: amountToAtoms()

> **amountToAtoms**(`value`): `bigint`

Convert decimal MINIMA text (`"0.2"`) to atoms (`2000...0n`).

Exact by construction: a fraction longer than 44 places is rejected when it
carries value, and anything that is not a non-negative plain decimal is
rejected. Fail closed — truncating here would silently change the amount.

## Parameters

### value

`string`

## Returns

`bigint`
