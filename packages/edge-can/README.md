# @totemsdk/edge-can

Edge runtime adapter for CAN bus — automotive, heavy machinery, socketcan.

## Install

```bash
npm install @totemsdk/edge-can
```

## Design

This package does **not** import `socketcan`, `pcan`, or any CAN library. All CAN interface behaviour is injected via `CanTransportPort`. The package handles DBC signal decoding, frame filtering, and proof generation.

## Quick start

```ts
import { createEdgeRuntime, createEdgeDevice, createCapabilitySet } from '@totemsdk/edge';
import { createCanGateway, createCanSensorBridge } from '@totemsdk/edge-can';
import type { CanTransportPort } from '@totemsdk/edge-can';

// 1. Implement CanTransportPort
const transport: CanTransportPort = {
  async open(iface) { /* open socketcan interface */ },
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

// 3. Create gateway with DBC signal definitions
const gateway = createCanGateway({
  runtime,
  transport,
  interfaceName: 'can0',
  signals: [
    { name: 'EngineSpeed', canId: 0x100, isExtended: false, startBit: 0, length: 16, isSigned: false, isBigEndian: true, scale: 1, offset: 0, unit: 'rpm' },
    { name: 'CoolantTemp', canId: 0x100, isExtended: false, startBit: 16, length: 8, isSigned: false, isBigEndian: true, scale: 1, offset: -40, unit: '°C' },
  ],
});
await gateway.start();
// Signals are automatically decoded and sent to the proof port

// 4. Or use the sensor bridge for targeted signal monitoring
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
| `startBit` | Bit position within the data field |
| `length` | Number of bits |
| `isSigned` | Whether the value is signed |
| `isBigEndian` | Motorola (big-endian) or Intel (little-endian) byte order |
| `scale` | Multiplier |
| `offset` | Additive offset |
| `unit` | Display unit (e.g. "rpm", "°C") |

## Capabilities

- `transport:can` — required for CAN bus transport

## License

MIT
