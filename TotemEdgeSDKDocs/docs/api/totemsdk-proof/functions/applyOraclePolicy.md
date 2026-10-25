[**@totemsdk/proof**](../index.md)

***

[@totemsdk/proof](../index.md) / applyOraclePolicy

# Function: applyOraclePolicy()

> **applyOraclePolicy**(`observations`, `policy`, `nowMs`, `opts?`): [`OraclePolicyResult`](../type-aliases/OraclePolicyResult.md)

Apply an oracle policy to a candidate observation set. Returns the verified set, or
fails closed with a reason. `nowMs` is supplied by the caller (pure code — no
wall-clock). Signature/revocation/evidence-byte checks are the caller's (see header).

## Parameters

### observations

[`OracleObservationV1`](../interfaces/OracleObservationV1.md)[]

### policy

[`OraclePolicy`](../interfaces/OraclePolicy.md)

### nowMs

`number`

### opts?

[`ApplyOraclePolicyOptions`](../interfaces/ApplyOraclePolicyOptions.md) = `{}`

## Returns

[`OraclePolicyResult`](../type-aliases/OraclePolicyResult.md)
