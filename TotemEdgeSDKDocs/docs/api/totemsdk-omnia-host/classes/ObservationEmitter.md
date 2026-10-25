[**@totemsdk/omnia-host**](../index.md)

***

[@totemsdk/omnia-host](../index.md) / ObservationEmitter

# Class: ObservationEmitter

Builds, redacts and persists observation events, then fans them out live.

`emit()` never throws into a mutation: persistence/export failures are
reported out-of-band so a payment can never be blocked by the observer.

## Constructors

### Constructor

> **new ObservationEmitter**(`config`): `ObservationEmitter`

#### Parameters

##### config

[`ObservationEmitterConfig`](../interfaces/ObservationEmitterConfig.md)

#### Returns

`ObservationEmitter`

## Methods

### emit()

> **emit**(`input`): `Promise`\<[`OmniaObservation`](../interfaces/OmniaObservation.md) \| `undefined`\>

#### Parameters

##### input

[`EmitObservationInput`](../interfaces/EmitObservationInput.md)

#### Returns

`Promise`\<[`OmniaObservation`](../interfaces/OmniaObservation.md) \| `undefined`\>
