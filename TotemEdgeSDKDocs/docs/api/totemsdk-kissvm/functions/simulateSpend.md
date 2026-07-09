[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / simulateSpend

# Function: simulateSpend()

> **simulateSpend**(`scriptStr`, `coinData`, `txContext`, `witness?`): `Promise`\<[`EvalResult`](../interfaces/EvalResult.md)\>

simulateSpend — simulate a KISSVM coin-spend.

Populates the evaluator context from `coinData` (used as the input coin at
inputIndex 0) unless the caller has already provided `txContext.inputs`.
This ensures @ADDRESS, @AMOUNT, @TOKENID,

## Parameters

### scriptStr

`string`

### coinData

[`CoinData`](../interfaces/CoinData.md)

### txContext

[`TxContext`](../interfaces/TxContext.md)

### witness?

[`ScriptWitness`](../interfaces/ScriptWitness.md)

## Returns

`Promise`\<[`EvalResult`](../interfaces/EvalResult.md)\>

## COINAGE

and

## SCRIPT

resolve
correctly during evaluation.

Always computes (or forwards) a `txDigest` so SIGNEDBY/CHECKSIG perform
real WOTS signature verification.  Never uses simulationMode — callers
who need presence-only checks for script-logic unit tests must pass
`simulationMode: true` in `txContext` directly to `evaluateScript`.

Returns a Promise so callers can uniformly await it even though the
evaluation itself is synchronous.
