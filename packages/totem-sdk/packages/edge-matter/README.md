# @totemsdk/edge-matter

Edge runtime adapter for Matter — smart home, multi-transport, fabric management.

## Install

```bash
npm install @totemsdk/edge-matter
```

## Design

This package does **not** import the Matter SDK or any native bindings. All Matter behaviour is injected via `MatterTransportPort`. The package handles commissioning, attribute read/write, subscriptions, command invocation, and proof generation.

## Quick start

```ts
import { createEdgeRuntime, createEdgeDevice, createCapabilitySet } from '@totemsdk/edge';
import { createMatterGateway, createMatterSensorBridge } from '@totemsdk/edge-matter';
import type { MatterTransportPort } from '@totemsdk/edge-matter';

// 1. Implement MatterTransportPort (e.g. using Matter SDK Node.js bindings)
const transport: MatterTransportPort = {
  async init(vendorId, productId) { /* initialise Matter stack */ },
  async shutdown() { /* shutdown */ },
  async commission(device, setupCode) { /* commission device onto fabric */ return { nodeId: '', vendorId: 0, productId: 0, endpoints: [] }; },
  async decommission(nodeId) { /* remove from fabric */ },
  async readAttribute(nodeId, endpointId, clusterId, attributeId) { /* read attribute */ return { nodeId, endpointId, clusterId, attributeId, value: null, dataType: '', receivedAt: Date.now() }; },
  async writeAttribute(nodeId, endpointId, clusterId, attributeId, value) { /* write attribute */ },
  async subscribe(nodeId, endpointId, clusterId, attributeIds, minInterval, maxInterval) { /* subscribe to attribute changes */ return { onChange(handler) { return () => {}; }, async cancel() {} }; },
  async invokeCommand(nodeId, endpointId, clusterId, commandId, args) { /* invoke command */ return null; },
  onCommissioned(handler) { return () => {}; },
  onError(handler) { return () => {}; },
};

// 2. Wire into Edge runtime
const runtime = createEdgeRuntime({
  deviceId: 'matter-gateway-01',
  capabilities: createCapabilitySet(['transport:matter', 'proof:create']),
  ports: { /* proof port */ },
});

// 3. Create gateway with attribute subscriptions
const gateway = createMatterGateway({
  runtime,
  transport,
  vendorId: 0xFFF1,
  productId: 0x0001,
  subscriptions: [
    { nodeId: 'abc123', endpointId: 1, clusterId: 0x0402, attributeIds: [0x0000], sensorId: 'temp-sensor', minInterval: 1, maxInterval: 60 },
    { nodeId: 'abc123', endpointId: 1, clusterId: 0x0405, attributeIds: [0x0000], sensorId: 'humidity-sensor', minInterval: 1, maxInterval: 60 },
  ],
});
await gateway.start();
// Attribute changes are automatically sent to the proof port

// 4. Commission a device
const result = await gateway.commission(3840, '34970112332');
console.log(result.data?.node);

// 5. Read an attribute
const temp = await gateway.readAttribute('abc123', 1, 0x0402, 0x0000);
console.log(temp.data?.value);

// 6. Write an attribute
await gateway.writeAttribute('abc123', 1, 0x0006, 0x0000, 1); // on/off cluster, on

// 7. Invoke a command
await gateway.invokeCommand('abc123', 1, 0x0006, 0x0001, {}); // on/off cluster, off command

// 8. Or use the sensor bridge for polling
const bridge = createMatterSensorBridge({
  runtime,
  transport,
  gateway,
  bindings: [
    { sensorId: 'living-room-temp', nodeId: 'abc123', endpointId: 1, clusterId: 0x0402, attributeId: 0x0000, intervalMs: 30000, dataType: 'temperature', unit: '°C' },
  ],
});
await bridge.start();
```

## Common Matter clusters

| Cluster ID | Name | Description |
|-----------|------|-------------|
| 0x0006 | On/Off | Basic on/off control |
| 0x0008 | Level Control | Dimming |
| 0x0201 | Thermostat | HVAC control |
| 0x0402 | Temperature Measurement | Temperature sensor |
| 0x0405 | Relative Humidity Measurement | Humidity sensor |
| 0x0406 | Occupancy Sensing | Presence detection |
| 0x040D | Air Quality | Air quality sensor |
| 0x0500 | Identify | Device identification |

## Commissioning

Matter uses a setup code (11 or 21 digits) printed on the device or QR code. The discriminator (12-bit) is embedded in the setup code. Pass both to `gateway.commission()`.

## Capabilities

- `transport:matter` — required for Matter transport

## License

MIT
