# @totemsdk/edge-ble

Edge runtime adapter for BLE — wearables, beacons, proximity tracking.

## Install

```bash
npm install @totemsdk/edge-ble
```

## Design

This package does **not** import `noble`, `@abandonware/noble`, or any BLE library. All BLE stack behaviour is injected via `BleTransportPort`. The package handles scanning, connection management, GATT operations, and proof generation.

## Quick start

```ts
import { createEdgeRuntime, createEdgeDevice, createCapabilitySet } from '@totemsdk/edge';
import { createBleGateway, createBleSensorBridge } from '@totemsdk/edge-ble';
import type { BleTransportPort } from '@totemsdk/edge-ble';

// 1. Implement BleTransportPort (e.g. using noble on Node.js)
const transport: BleTransportPort = {
  async startScanning(serviceUUIDs) { /* start BLE scan */ },
  async stopScanning() { /* stop scan */ },
  async connect(peripheralId) { /* connect to peripheral */ },
  async disconnect(peripheralId) { /* disconnect */ },
  async discover(peripheralId) { /* discover services/characteristics */ return []; },
  async read(peripheralId, serviceUuid, characteristicUuid) { /* read characteristic */ return new Uint8Array(); },
  async write(peripheralId, serviceUuid, characteristicUuid, data) { /* write characteristic */ },
  async subscribe(peripheralId, serviceUuid, characteristicUuid) { /* subscribe to notifications */ },
  async unsubscribe(peripheralId, serviceUuid, characteristicUuid) { /* unsubscribe */ },
  onDiscover(handler) { return () => {}; },
  onNotification(handler) { return () => {}; },
  onDisconnect(handler) { return () => {}; },
  onError(handler) { return () => {}; },
};

// 2. Wire into Edge runtime
const runtime = createEdgeRuntime({
  deviceId: 'ble-gateway-01',
  capabilities: createCapabilitySet(['transport:ble', 'proof:create']),
  ports: { /* proof port */ },
});

// 3. Create gateway
const gateway = createBleGateway({ runtime, transport, scanServices: ['1809'] });
await gateway.start();
// Discovered peripherals are available at gateway.peripherals

// 4. Connect and read
await gateway.connect('abc123');
const result = await gateway.read('abc123', '1809', '2a6e');
console.log(result.data?.value); // temperature bytes

// 5. Subscribe to notifications
await gateway.subscribe('abc123', '1809', '2a6e');
// Notifications are automatically sent to the proof port

// 6. Or use the sensor bridge
const bridge = createBleSensorBridge({
  runtime,
  transport,
  gateway,
  bindings: [
    { sensorId: 'heart-rate', peripheralId: 'abc123', serviceUuid: '180d', characteristicUuid: '2a37', dataType: 'bpm' },
  ],
});
await bridge.start();
```

## Transport port

| Method | Description |
|--------|-------------|
| `startScanning(serviceUUIDs?)` | Start BLE scan, optionally filtered by service UUIDs |
| `stopScanning()` | Stop scanning |
| `connect(peripheralId)` | Connect to a peripheral |
| `disconnect(peripheralId)` | Disconnect |
| `discover(peripheralId)` | Discover services and characteristics |
| `read(peripheralId, svc, char)` | Read a characteristic value |
| `write(peripheralId, svc, char, data)` | Write a characteristic value |
| `subscribe(peripheralId, svc, char)` | Subscribe to notifications/indications |
| `unsubscribe(peripheralId, svc, char)` | Unsubscribe |
| `onDiscover(handler)` | Called when a peripheral is discovered |
| `onNotification(handler)` | Called on characteristic notification |
| `onDisconnect(handler)` | Called when a peripheral disconnects |
| `onError(handler)` | Called on BLE stack errors |

## Capabilities

- `transport:ble` — required for BLE transport

## License

MIT
