# @totemsdk/act-mavlink

Governed MAVLink / autonomous-flight profile (RFC-025) for the Totem governed
action runtime.

`act-mavlink` authorizes a **mission envelope** and lets the autopilot own the
control loop. It prepares commitment-bound mission commands, derives the
envelope's speed/duration/altitude effects for RFC-023, and reconciles
completion from vehicle telemetry — never from a command acknowledgement.

> **Boundary.** This package owns mission authority and evidence only. The wire
> frames belong to `@totemsdk/edge-mavlink`; stabilization, failsafes and the
> real-time loop belong to the autopilot. Offboard/velocity control is out of
> scope.

## Install

```bash
pnpm add @totemsdk/act-mavlink @totemsdk/act-core
```

## Use

The MAVLink client is injected through a port (SDK, bridge, or SITL simulator):

```ts
import { createMavlinkDefinitions, createMavlinkProfile, envelopeDigest } from '@totemsdk/act-mavlink';

const vehicles = [{
  vehicleId: 'DRONE-1',
  maxSpeedMetresPerSecond: '15',
  maxAltitudeMetres: '120',
  maxDurationSeconds: '1800',
}];

const profile = createMavlinkProfile({ site: 'site-1', vehicles });
const definitions = createMavlinkDefinitions({ transport, site: 'site-1', vehicles });

const envelope = {
  envelopeId: 'survey-1',
  vehicle: 'DRONE-1',
  waypoints: [
    { latitudeDeg: 51.5, longitudeDeg: -0.12, altitudeMetres: 30 },
    { latitudeDeg: 51.501, longitudeDeg: -0.121, altitudeMetres: 40 },
  ],
  maxAltitudeMetres: '120',
  maxSpeedMetresPerSecond: '12',
  maxDurationSeconds: '900',
  geofence: { latitudeDeg: 51.5, longitudeDeg: -0.12, radiusMetres: 1000 },
};

const digest = envelopeDigest(envelope); // authorize this digest
```

Register the definitions with `act-core`'s `toEdgeActionDefinition` and the
profile's resources/interlocks.

## Governed operations

| Kind | Effect | Failure mode | Async |
|---|---|---|---|
| `flight:uploadMission` | write | abort (pre-dispatch) | completed |
| `flight:startMission` | write | fail-safe (return to launch) | accepted → confirmed |
| `flight:hold` | write | fail-safe (return to launch) | accepted → confirmed |
| `flight:returnToLaunch` | write | fail-safe (land) | accepted → confirmed |
| `flight:land` | write | fail-safe (land) | accepted → confirmed |
| `flight:readTelemetry` | read | fail-silent | completed |

`startMission` requires the authorized `envelopeDigest`; the adapter recomputes
the digest from the prepared envelope and **fails closed** on any mismatch, so a
start cannot reference a different plan. Acceptance is never completion:
`reconcile` reads telemetry and reports `confirmed` only on observed arrival at
the final waypoint within the tolerance (default 15 m).

## Mission envelope

`validateMissionEnvelope` enforces:

- 1–100 waypoints with valid WGS-84 coordinates;
- waypoint altitude at or below `maxAltitudeMetres`;
- positive speed and duration ceilings;
- every waypoint inside the declared geofence (haversine distance).

The envelope digest is canonical and is bound into the commitment and receipt.

## Conformance

`runMavlinkConformance(transport, { site, vehicles, envelope })` is the
per-autopilot gate. It checks envelope validity, geofence rejection, mission
upload/start round-trip, the authorized digest binding, telemetry shape,
acceptance-vs-completion semantics and safe-state availability. A second
autopilot must ship as a separately tested profile, not by loosening this one.

## Error taxonomy

`GEOFENCE_BREACH`, `FAILSAFE_TRIGGERED` and battery-critical codes are `safety`
and command the safe state without retry; mission rejections are `permanent`;
link timeouts are `transient`; denials are `auth`.

## Known limits

- The client SDK/autopilot foundation is not bundled or version-pinned: the
  deployment supplies the transport (RFC-025 §9 remains an integration decision).
- Offboard/velocity control is intentionally excluded; v1 governs bounded
  missions, not stick inputs.
- Cancellation is `unknown` until reconciled; a cancel is never treated as zero
  consumption.

See `docs/rfc/RFC-025-MAVLINK-AUTONOMOUS-FLIGHT-PROFILE.md`.
