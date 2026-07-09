[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / evaluateScript

# Function: evaluateScript()

> **evaluateScript**(`script`, `witness`, `txCtx`): [`EvalResult`](../interfaces/EvalResult.md)

Evaluate a KISSVM script.

Returns `EvalResult` for normal termination (RETURN, ASSERT failure, runtime errors).
**Throws `KissvmLimitError`** if any safety limit (instructions, stack depth, shift
size) is exceeded — callers must handle this case separately.

## Parameters

### script

`string`

### witness

[`ScriptWitness`](../interfaces/ScriptWitness.md)

### txCtx

[`TxContext`](../interfaces/TxContext.md)

## Returns

[`EvalResult`](../interfaces/EvalResult.md)
