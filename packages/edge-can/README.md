# @totemsdk/edge-can

Edge runtime adapter for CAN bus — automotive, heavy machinery, SocketCAN.

## Install

```bash
npm install @totemsdk/edge-can
```

## Design

This package does **not** import `socketcan`, `pcan`, or any CAN library. All CAN
interface behaviour is injected via `CanTransportPort`, and the package handles
DBC signal decoding, acceptance filtering, frame validation and proof
generation.

The qualified profile is **classic CAN 2.0A/B** (11-bit or 29-bit IDs, 0–8 data
bytes) over Linux SocketCAN/vcan. CAN FD is rejected explicitly rather than
mis-parsed. See [Qualified profile](#qualified-profile).

## Quick start

```ts
import { createEdgeRuntime, createEdgeDevice, createCapabilitySet } from '@totemsdk/edge';
import { createCanGateway, createCanSensorBridge } from '@totemsdk/edge-can';
import type { CanTransportPort } from '@totemsdk/edge-can';

// 1. Implement CanTransportPort
const transport: CanTransportPort = {
  async open(iface) { /* open SocketCAN interface */ },
  async close() { /* close */ },
  async send(id, data, isExtended) { /* send CAN frame */ },
  onFrame(handler) { /* register frame handler */ return () => {}; },
  onError(handler) { /* register error handler */ return () => {}; },
};

// 2. Wire into Edge runtime
const runtime = createEdgeRuntime({
  deviceId: 'can-gateway-01',
  capabilities: createCapabilitySet(['transport:can', 'proof:create']),
  ports: { /* proof port */ },
});

// 3. Create gateway with DBC definitions and optional acceptance filters
const gateway = createCanGateway({
  runtime,
  transport,
  interfaceName: 'can0',
  filters: [{ id: 0x100 }, { id: 0x18ff0000, mask: 0x1fff0000, isExtended: true }],
  signals: [
    { name: 'EngineSpeed', canId: 0x100, isExtended: false, startBit: 0, length: 16, isSigned: false, isBigEndian: true, scale: 1, offset: 0, unit: 'rpm' },
    { name: 'CoolantTemp', canId: 0x100, isExtended: false, startBit: 23, length: 8, isSigned: false, isBigEndian: true, scale: 1, offset: -40, unit: '°C' },
  ],
});
await gateway.start();

// 4. Or use the sensor bridge for targeted frame monitoring
const bridge = createCanSensorBridge({
  runtime,
  transport,
  gateway,
  bindings: [
    { sensorId: 'engine-rpm', canId: 0x100, isExtended: false, signalName: 'EngineSpeed' },
  ],
});
await bridge.start();
```

## DBC signal definitions

| Field | Description |
|-------|-------------|
| `name` | Signal name from DBC file |
| `canId` | 11-bit or 29-bit arbitration ID |
| `isExtended` | Whether this is an extended (29-bit) frame |
| `startBit` | Intel: least-significant bit position. Motorola: most-significant (DBC) bit position |
| `length` | Number of bits (1–64; values above 53 lose precision) |
| `isSigned` | Whether the value is signed |
| `isBigEndian` | Motorola (big-endian) or Intel (little-endian) byte order |
| `scale` | Multiplier |
| `offset` | Additive offset |
| `unit` | Display unit (e.g. "rpm", "°C") |

Invalid IDs, start bits, lengths or non-finite scale/offset values throw when the
gateway is created instead of producing silently wrong readings.

## Acceptance filters

`filters` is optional. When present, a frame must match at least one filter
before it is decoded:

```ts
{ id: 0x123 }                                  // exact 11-bit ID
{ id: 0x120, mask: 0x7f0 }                     // masked: 0x120–0x12f
{ id: 0x18ff0000, mask: 0x1fff0000, isExtended: true }
```

`mask` defaults to the full 11-bit or 29-bit width. When `isExtended` is
omitted, the namespace is inferred from the filter ID (11-bit IDs are classic,
wider IDs are extended); set it explicitly when you want the ambiguity removed.
Filtering happens in the gateway; the sidecar still receives bus traffic.

## Transport and sidecar

Frames are validated on receipt (ID width, DLC 0–8, payload length matching DLC)
and remote transmission request frames are ignored. `gateway.send` validates the
ID and payload before delegating to the transport.

`NativeCanTransport` speaks newline-delimited JSON to the Go sidecar:

- `open` / `close` / `send` requests with per-request correlation;
- `frame` pushes for received frames;
- `error` pushes for bus errors, bus-off, unsupported CAN FD frames and read
  failures. A valid frame after an error returns the gateway to `running`.

The sidecar reopens the interface after bus-off, rejects invalid IDs/payloads
and survives interface down/up without a read busy-loop. It does not bundle
platform binaries; see [sidecar.json](./sidecar.json) for the source-build and
protocol contract.

## Qualified profile

`@totemsdk/edge-can` is **v1** for this profile; the support tier remains
`outside` because no physical CAN controller matrix is claimed.

Qualified by `tests/qualification/edge-can/` on Linux vcan:

- classic CAN 2.0A/B, 11-bit and 29-bit IDs, 0–8 byte payloads;
- DBC decoding (Intel and Motorola), acceptance filtering;
- sidecar request validation and crash/restart recovery;
- source build of the Go sidecar with `edge-can --version` protocol 1.

Not qualified:

- CAN FD (FDF/BRS/ESI) or payloads over 8 bytes;
- physical CAN controllers or hardware-injected bus-off;
- Windows/macOS prebuilt sidecar binaries;
- hot upgrade or rolling sidecar replacement;
- multiple clients concurrently owning one interface.

## Capabilities

- `transport:can` — required for CAN bus transport

## Testing

Tests live outside the published package. Package `test:*` scripts are
repository delegates; tests are not shipped.

- Unit: `tests/unit/edge-can/`
- Go frame/validation: `pnpm --filter @totemsdk/edge-can test:go`
- Linux vcan conformance: `test:conformance`
- Linux vcan integration (filtering, extended IDs, sidecar validation): `test:integration`
- Linux vcan recovery (link outage, crash/restart, teardown): `test:recovery`

## License

Apache-2.0 — see [LICENSE](./LICENSE) and [NOTICE](./NOTICE).
