[**@totemsdk/qvac**](../index.md)

***

[@totemsdk/qvac](../index.md) / verifyQvacRuntimeBehavior

# Function: verifyQvacRuntimeBehavior()

> **verifyQvacRuntimeBehavior**(`input`): `Promise`\<[`QvacRuntimeVerificationMark`](../interfaces/QvacRuntimeVerificationMark.md)\>

Exercise the injected runtime against the three Phase 3a scenarios and
return a `provider-verified` mark. Throws on any violation — a scenario
that the runtime fails is surfaced, never relabelled as an SDK guarantee.

## Parameters

### input

[`VerifyQvacRuntimeBehaviorInput`](../interfaces/VerifyQvacRuntimeBehaviorInput.md)

## Returns

`Promise`\<[`QvacRuntimeVerificationMark`](../interfaces/QvacRuntimeVerificationMark.md)\>
