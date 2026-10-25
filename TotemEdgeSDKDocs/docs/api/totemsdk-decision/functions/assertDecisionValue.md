[**@totemsdk/decision**](../index.md)

***

[@totemsdk/decision](../index.md) / assertDecisionValue

# Function: assertDecisionValue()

> **assertDecisionValue**(`value`, `path?`): `asserts value is DecisionValue`

Assert that `value` is a canonical [DecisionValue](../type-aliases/DecisionValue.md). Rejects `NaN`,
`±Infinity`, `undefined`, functions, symbols, dates, class instances, and
cyclic structures.

## Parameters

### value

`unknown`

### path?

`string` = `'$'`

## Returns

`asserts value is DecisionValue`
