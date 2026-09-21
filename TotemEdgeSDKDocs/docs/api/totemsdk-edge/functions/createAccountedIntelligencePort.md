[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / createAccountedIntelligencePort

# Function: createAccountedIntelligencePort()

> **createAccountedIntelligencePort**(`options`): [`EdgeIntelligencePort`](../interfaces/EdgeIntelligencePort.md)

Bind an [EdgeIntelligencePort](../interfaces/EdgeIntelligencePort.md) and a Journal into an
accounted port. The wrapper is provider-neutral — it only ever sees
`EdgeIntelligencePort`'s provider-agnostic surface.

Guarantees:
- A `started` event exists iff the provider was actually dispatched to
  (a pre-aborted signal short-circuits to `CANCELLED` with no journal write).
- Every dispatched call is closed by a `finished` event; a thrown provider
  call is closed as `outcome-unknown` and rethrown (behavior unchanged).
- No receipt is ever fabricated here.

## Parameters

### options

[`CreateAccountedIntelligencePortOptions`](../interfaces/CreateAccountedIntelligencePortOptions.md)

## Returns

[`EdgeIntelligencePort`](../interfaces/EdgeIntelligencePort.md)
