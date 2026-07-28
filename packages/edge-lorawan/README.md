# @totemsdk/edge-lorawan

Edge runtime adapter for LoRaWAN — agriculture, asset tracking, long-range sensors.

## Install

```bash
npm install @totemsdk/edge-lorawan
```

## Design

This package does **not** import any LoRa radio library or network server client. All radio/network behaviour is injected via `LorawanTransportPort`. The package handles OTAA/ABP activation, uplink/downlink framing, and proof generation.

## Quick start

```ts
import { createEdgeRuntime, createEdgeDevice, createCapabilitySet } from '@totemsdk/edge';
import { createLorawanGateway, createLorawanSensorBridge } from '@totemsdk/edge-lorawan';
import type { LorawanTransportPort } from '@totemsdk/edge-lorawan';

// 1. Implement LorawanTransportPort
const transport: LorawanTransportPort = {
  async joinOtaa(devEui, appEui, appKey) { /* OTAA join procedure */ },
  async activateAbp(devAddr, nwkSKey, appSKey) { /* ABP activation */ },
  async sendConfirmed(port, data) { /* send confirmed uplink */ },
  async sendUnconfirmed(port, data) { /* send unconfirmed uplink */ },
  onDownlink(handler) { return () => {}; },
  onJoin(handler) { return () => {}; },
  onError(handler) { return () => {}; },
};

// 2. Wire into Edge runtime
const runtime = createEdgeRuntime({
  deviceId: 'lorawan-gateway-01',
  capabilities: createCapabilitySet(['transport:lorawan', 'proof:create']),
  ports: { /* proof port */ },
});

// 3. Create gateway with OTAA credentials
const gateway = createLorawanGateway({
  runtime,
  transport,
  otaa: { devEui: '0123456789ABCDEF', appEui: 'FEDCBA9876543210', appKey: '00112233445566778899AABBCCDDEEFF' },
});
await gateway.start();
// Join and downlink events are automatically sent to the proof port

// 4. Send sensor data
await gateway.sendUnconfirmed(1, new TextEncoder().encode('{"temp": 23.5}'));

// 5. Or use the sensor bridge
const bridge = createLorawanSensorBridge({
  runtime,
  transport,
  gateway,
  bindings: [
    { sensorId: 'soil-moisture', port: 1, intervalMs: 300_000, dataType: 'soil-moisture', unit: '%' },
  ],
});
await bridge.start();
```

## Activation methods

| Method | Description |
|--------|-------------|
| OTAA | Over-The-Air Activation — `joinOtaa(devEui, appEui, appKey)` |
| ABP | Activation By Personalization — `activateAbp(devAddr, nwkSKey, appSKey)` |

## Transport port

| Method | Description |
|--------|-------------|
| `joinOtaa(devEui, appEui, appKey)` | Perform OTAA join |
| `activateAbp(devAddr, nwkSKey, appSKey)` | Activate with pre-provisioned ABP keys |
| `sendConfirmed(port, data)` | Send confirmed uplink (requires ACK) |
| `sendUnconfirmed(port, data)` | Send unconfirmed uplink (no ACK) |
| `onDownlink(handler)` | Register handler for downlink messages |
| `onJoin(handler)` | Register handler for successful join |
| `onError(handler)` | Register handler for radio/network errors |

## Capabilities

- `transport:lorawan` — required for LoRaWAN transport

## License

MIT
