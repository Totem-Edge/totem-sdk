# @totemsdk/edge-bacnet

Edge runtime adapter for BACnet — building automation, HVAC, device properties.

## Install

```bash
npm install @totemsdk/edge-bacnet
```

## Design

This package does **not** import `node-bacnet` or any BACnet stack. All BACnet behaviour is injected via `BacnetTransportPort`. The package handles device discovery, property read/write, COV subscriptions, and proof generation.

## Quick start

```ts
import { createEdgeRuntime, createEdgeDevice, createCapabilitySet } from '@totemsdk/edge';
import { createBacnetGateway, createBacnetSensorBridge } from '@totemsdk/edge-bacnet';
import type { BacnetTransportPort } from '@totemsdk/edge-bacnet';

// 1. Implement BacnetTransportPort (e.g. using node-bacnet)
const transport: BacnetTransportPort = {
  async init(deviceId, deviceName) { /* initialise BACnet stack */ },
  async close() { /* shutdown */ },
  async discoverDevices() { /* send Who-Is, collect I-Am responses */ return []; },
  async readProperty(deviceId, objectType, objectInstance, propertyId) { /* read property */ return { objectType, objectInstance, propertyId, propertyName: '', value: null, dataType: '' }; },
  async writeProperty(deviceId, objectType, objectInstance, propertyId, value, priority) { /* write property */ },
  async subscribeCov(deviceId, objectType, objectInstance, lifetime) { /* subscribe to COV */ return { onChange(handler) { return () => {}; }, async cancel() {} }; },
  onDeviceDiscovered(handler) { return () => {}; },
  onError(handler) { return () => {}; },
};

// 2. Wire into Edge runtime
const runtime = createEdgeRuntime({
  deviceId: 'bacnet-gateway-01',
  capabilities: createCapabilitySet(['transport:bacnet', 'proof:create']),
  ports: { /* proof port */ },
});

// 3. Create gateway with COV subscriptions
const gateway = createBacnetGateway({
  runtime,
  transport,
  deviceId: 1001,
  deviceName: 'TotemEdge',
  covSubscriptions: [
    { deviceId: 2001, objectType: 'analogInput', objectInstance: 1, sensorId: 'zone-temp', lifetime: 300 },
    { deviceId: 2001, objectType: 'analogInput', objectInstance: 2, sensorId: 'zone-humidity', lifetime: 300 },
  ],
});
await gateway.start();
// COV notifications are automatically sent to the proof port

// 4. Discover devices
const devices = await gateway.discoverDevices();
console.log(devices.data?.devices);

// 5. Read a property
const value = await gateway.readProperty(2001, 'analogInput', 1, 85); // present-value
console.log(value.data?.value);

// 6. Write a property
await gateway.writeProperty(2001, 'analogOutput', 1, 85, 22.5, 8); // priority 8

// 7. Or use the sensor bridge for polling
const bridge = createBacnetSensorBridge({
  runtime,
  transport,
  gateway,
  bindings: [
    { sensorId: 'zone-temp', deviceId: 2001, objectType: 'analogInput', objectInstance: 1, propertyId: 85, intervalMs: 10000, dataType: 'temperature', unit: '°C' },
  ],
});
await bridge.start();
```

## Common BACnet object types

| Type | Description |
|------|-------------|
| `analogInput` | Sensor reading (temperature, pressure, etc.) |
| `analogOutput` | Actuator setpoint |
| `analogValue` | Configuration parameter |
| `binaryInput` | Switch/contact status |
| `binaryOutput` | Relay/valve command |
| `multiStateInput` | Mode selector |
| `multiStateOutput` | Mode command |

## Common property IDs

| ID | Name | Description |
|----|------|-------------|
| 85 | `presentValue` | Current value |
| 77 | `objectName` | Human-readable name |
| 75 | `units` | Engineering units |
| 28 | `description` | Text description |

## Capabilities

- `transport:bacnet` — required for BACnet transport

## License

MIT
