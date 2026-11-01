# @totemsdk/edge-mavlink

Edge runtime adapter for MAVLink — drone telemetry, heartbeat, commands and wire framing.

> **Wire layer only.** This package frames, checksums and decodes MAVLink
> messages. It does not authorize a mission, geofence, speed or altitude
> envelope. Governed flight actions belong to `@totemsdk/act-mavlink` (RFC-025),
> built on `@totemsdk/act-core`.

## Install

```bash
npm install @totemsdk/edge-mavlink
```

## Design

A byte-oriented transport is injected via `MavlinkTransportPort` (serial, UDP,
TCP, WebSocket or simulator). The connector owns MAVLink 1/2 framing, X25
checksums with CRC_EXTRA, common-message decoding, heartbeat generation,
COMMAND_LONG transmission and COMMAND_ACK correlation.

## Quick start

```ts
import { createMavlinkGateway, createMavlinkSensorBridge, MESSAGE_IDS } from '@totemsdk/edge-mavlink';
import type { MavlinkTransportPort } from '@totemsdk/edge-mavlink';

const transport: MavlinkTransportPort = {
  async start() { /* open serial/UDP */ },
  async stop() { /* close */ },
  async send(bytes) { /* write frame */ },
  onData(handler) { /* feed received bytes */ return () => {}; },
  onError(handler) { return () => {}; },
};

const gateway = createMavlinkGateway({
  runtime,
  transport,
  systemId: 255,      // GCS
  componentId: 190,
  targetSystemId: 42, // vehicle
  heartbeatIntervalMs: 1000,
});
await gateway.start();

gateway.onMessage(MESSAGE_IDS.GPS_RAW_INT, (message) => {
  console.log(message.decoded.lat, message.decoded.lon, message.decoded.satellites);
});

const armed = await gateway.command(400); // MAV_CMD_COMPONENT_ARM_DISARM

const bridge = createMavlinkSensorBridge({
  runtime,
  gateway,
  bindings: [{ sensorId: 'drone-position', messageId: MESSAGE_IDS.GPS_RAW_INT }],
});
await bridge.start();
```

## Supported wire surface

- MAVLink 1 and 2 frame encode/decode; X25 CRC + CRC_EXTRA verification.
- MAVLink 2 signed frames are accepted; the signature is carried but not
  verified (signing policy is caller-owned).
- Decoded messages: `HEARTBEAT`, `SYS_STATUS`, `GPS_RAW_INT`, `ATTITUDE`,
  `GLOBAL_POSITION_INT`, `COMMAND_ACK`, `STATUSTEXT`.
- Encoded: `HEARTBEAT`, `COMMAND_LONG`.
- Unknown message IDs are ignored at the framing layer.

## Qualification status

`@totemsdk/edge-mavlink` is **RC**. The qualified profile covers framing and
CRC vectors, fragmented byte streams, heartbeat generation, telemetry decoding,
COMMAND_LONG/COMMAND_ACK correlation/timeouts, sensor proofs, error state and
teardown against an injected transport simulator.

Not qualified: real serial/UDP transports, MAVLink signing verification,
mission upload/download, offboard control, parameter protocols, and the governed
flight envelope. Those belong to `act-mavlink`/the transport binding.

## Testing

Tests live outside the published package. Package `test:*` scripts are
repository delegates; tests are not shipped.

- Unit (framing, gateway, bridge): `npm test`
- Simulator integration: `npm run test:integration`

## License

Apache-2.0 — see [LICENSE](./LICENSE) and [NOTICE](./NOTICE).
