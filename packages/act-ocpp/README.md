# @totemsdk/act-ocpp

Governed OCPP / EV-charging profile (RFC-024) for the Totem governed action
runtime.

`act-ocpp` authorizes and bounds a charging operation: it prepares a
commitment-bound OCPP command, derives the physical effects (power, energy,
duration, charging profile) that RFC-023 enforces, and tracks the session
through the RFC-022 async lifecycle until the charger proves completion.

> **Boundary.** This package owns governed charging semantics only. The wire
> frames belong to `@totemsdk/edge-ocpp`; electrical protection, the BMS and the
> charging control loop belong to the charger/CSMS. Payments are not handled
> here.

## Install

```bash
pnpm add @totemsdk/act-ocpp @totemsdk/act-core
```

## Use

The OCPP stack is injected through a port, so a deployment can back it with a
CSMS client, a charger stack, or a simulator:

```ts
import { createOcppDefinitions, createOcppProfile, negotiateOcppCapabilities } from '@totemsdk/act-ocpp';

const capabilities = negotiateOcppCapabilities({ offered: ['1.6J', '2.0.1'] });

const profile = createOcppProfile({
  site: 'site-1',
  connectors: [{ connectorId: 1, maxPowerWatts: '11000', maxEnergyWattHours: '22000' }],
  capabilities,
});

const definitions = createOcppDefinitions({
  transport,          // your OcppTransportPort implementation
  site: 'site-1',
  connectors: [{ connectorId: 1, maxPowerWatts: '11000', maxEnergyWattHours: '22000' }],
  capabilities,
});
```

Register the definitions on the edge runtime with `act-core`'s
`toEdgeActionDefinition`, together with the profile's resources and interlocks.

## Governed operations

| Kind | Effect | Failure mode | Async |
|---|---|---|---|
| `charging:startSession` | write | fail-safe (stop session) | accepted → confirmed |
| `charging:stopSession` | write | fail-safe | accepted → confirmed |
| `charging:setLimit` | write | fail-safe (clear profile) | completed |
| `charging:reserveConnector` | write | fail-closed | completed |
| `charging:clearProfile` | write | fail-safe | completed |
| `charging:readMeter` | read | fail-silent | completed |

`startSession` and `stopSession` use `confirmation: 'accepted'`: the CSMS
acknowledgement is not completion. `reconcile` reads the charger's transaction
state and meter register, and only reports `confirmed` when the transaction has
ended. Configuration writes are `completed` because the acknowledgement is the
terminal state for a profile/reservation change.

## Physical effects

Every write derives its effects from the prepared command only:

```ts
{
  physical: {
    power:    [{ resource, watts }],
    energy:   [{ resource, wattHours }],
    duration: [{ resource, seconds }],
    envelopes:[{ envelopeId, envelopeDigest }],
  }
}
```

The envelope digest is the canonical hash of the applied charging profile, so a
receipt proves which schedule bounded the command. Connector interlocks reject a
request above the connector's declared ceiling before authorization.

## Meter evidence

`reconcileChargingSession` returns charger-sourced evidence:

```ts
{
  status: 'confirmed',
  energyWattHours: '6120',
  evidence: { operationId, transactionId, connectorId, readings, digest },
}
```

The caller-supplied payload cannot assert meter values; they always come from
the transport. The digest is canonical across reading order, so a settlement
action can cite the charging operation id.

## Error taxonomy

OCPP status codes are registered in the device error taxonomy: protection faults
(`GroundFailure`, `OverVoltage`, `HighTemperature`, …) are `safety` and never
retried; `Occupied`/`Reserved`/`Unavailable` are `permanent`; link/timeout
conditions are `transient` (safe only because the prepared command and operation
id make a retry idempotent); identity failures are `auth`.

## Known limits

- OCPP 2.1 bidirectional/DER is designed for but not implemented; it is gated as
  `charging:bidirectional` and not registered.
- The CSMS/charger foundation is not bundled or version-pinned: the deployment
  supplies the transport (RFC-024 §9 remains an integration decision).
- Electrical protection and payment processing are out of scope.

See `docs/rfc/RFC-024-OCPP-EV-CHARGING-PROFILE.md`.
