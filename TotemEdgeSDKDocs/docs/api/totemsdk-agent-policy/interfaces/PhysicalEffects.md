[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / PhysicalEffects

# Interface: PhysicalEffects

RFC-023 typed physical effects. These must be derived from the PREPARED
operation, never from agent-supplied hints, and are enforced by
`checkRunLimits`.

## Properties

### duration?

> `optional` **duration?**: [`DurationEffect`](DurationEffect.md)[]

***

### energy?

> `optional` **energy?**: [`EnergyEffect`](EnergyEffect.md)[]

***

### envelopes?

> `optional` **envelopes?**: [`EnvelopeRef`](EnvelopeRef.md)[]

Mission/operation envelopes the prepared command is confined to.

***

### power?

> `optional` **power?**: [`PowerEffect`](PowerEffect.md)[]

***

### speed?

> `optional` **speed?**: [`SpeedEffect`](SpeedEffect.md)[]
