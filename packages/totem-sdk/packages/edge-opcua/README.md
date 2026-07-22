# @totemsdk/edge-opcua

Edge runtime adapter for OPC-UA — SCADA, factory floors, industrial automation.

## Install

```bash
npm install @totemsdk/edge-opcua
```

## Design

This package does **not** import `node-opcua` or any OPC-UA stack. All OPC-UA behaviour is injected via `OpcuaTransportPort`. The package handles secure channel management, node browsing, monitored item subscriptions, and proof generation.

## Quick start

```ts
import { createEdgeRuntime, createEdgeDevice, createCapabilitySet } from '@totemsdk/edge';
import { createOpcuaGateway, createOpcuaSensorBridge } from '@totemsdk/edge-opcua';
import type { OpcuaTransportPort } from '@totemsdk/edge-opcua';

// 1. Implement OpcuaTransportPort (e.g. using node-opcua)
const transport: OpcuaTransportPort = {
  async connect(endpointUrl) { /* create secure channel + session */ },
  async disconnect() { /* close session */ },
  async browse(nodeId) { /* browse address space */ return []; },
  async read(nodeId) { /* read node value */ return { value: null, dataType: 'String' }; },
  async write(nodeId, value) { /* write node value */ },
  async subscribe(nodeIds, samplingInterval) { /* create monitored items */ return { async addNodes(ids) {}, async removeNodes(ids) {}, onChange(handler) { return () => {}; }, async destroy() {} }; },
  async call(objectId, methodId, args) { /* call method */ return []; },
  onError(handler) { return () => {}; },
};

// 2. Wire into Edge runtime
const runtime = createEdgeRuntime({
  deviceId: 'opcua-gateway-01',
  capabilities: createCapabilitySet(['transport:opcua', 'proof:create']),
  ports: { /* proof port */ },
});

// 3. Create gateway with monitored item subscriptions
const gateway = createOpcuaGateway({
  runtime,
  transport,
  endpointUrl: 'opc.tcp://192.168.1.100:4840',
  subscriptions: [
    { nodeId: 'ns=2;s=Temperature', sensorId: 'temp-sensor', samplingInterval: 1000 },
    { nodeId: 'ns=2;s=Pressure', sensorId: 'pressure-sensor', samplingInterval: 500 },
  ],
});
await gateway.start();
// Value changes are automatically sent to the proof port

// 4. Browse the address space
const nodes = await gateway.browse('ns=2;s=Root');
console.log(nodes.data?.nodes);

// 5. Read a single node
const value = await gateway.read('ns=2;s=Temperature');
console.log(value.data?.value);

// 6. Write a value
await gateway.write('ns=2;s=SetPoint', { value: 100, dataType: 'Double' });

// 7. Call a method
const results = await gateway.call('ns=2;s=Pump', 'ns=2;s=Start', [{ value: true, dataType: 'Boolean' }]);

// 8. Or use the sensor bridge for polling
const bridge = createOpcuaSensorBridge({
  runtime,
  transport,
  gateway,
  bindings: [
    { sensorId: 'temp-zone-1', nodeId: 'ns=2;s=Temperature', intervalMs: 5000, dataType: 'temperature', unit: '°C' },
  ],
});
await bridge.start();
```

## Transport port

| Method | Description |
|--------|-------------|
| `connect(endpointUrl)` | Connect to OPC-UA server, create secure channel + session |
| `disconnect()` | Close session and secure channel |
| `browse(nodeId)` | Browse the server's address space |
| `read(nodeId)` | Read a node's value |
| `write(nodeId, value)` | Write a value to a node |
| `subscribe(nodeIds, interval)` | Create a monitored item subscription |
| `call(objectId, methodId, args)` | Call a method on an object node |
| `onError(handler)` | Register handler for session errors |

## Capabilities

- `transport:opcua` — required for OPC-UA transport

## License

MIT
