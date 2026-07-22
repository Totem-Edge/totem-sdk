# @totemsdk/edge-modbus

Edge runtime adapter for Modbus — PLCs, RTUs, industrial sensors over serial/TCP.

## Install

```bash
npm install @totemsdk/edge-modbus
```

## Design

This package does **not** import `modbus-serial`, `net`, or `serialport`. All network/serial behaviour is injected via `ModbusTransportPort`. You provide the transport; the package handles framing, polling, and proof generation.

## Quick start

```ts
import { createEdgeRuntime, createEdgeDevice, createCapabilitySet } from '@totemsdk/edge';
import { createModbusGateway, createModbusSensorBridge } from '@totemsdk/edge-modbus';
import type { ModbusTransportPort } from '@totemsdk/edge-modbus';

// 1. Implement ModbusTransportPort for your environment
const transport: ModbusTransportPort = {
  async connect() { /* open TCP socket or serial port */ },
  async disconnect() { /* close */ },
  async sendFrame(frame) { /* send raw Modbus frame, return response */ },
  onFrame(handler) { /* register inbound frame handler */ return () => {}; },
  onError(handler) { /* register error handler */ return () => {}; },
};

// 2. Wire into Edge runtime
const runtime = createEdgeRuntime({
  deviceId: 'plc-gateway-01',
  capabilities: createCapabilitySet(['transport:modbus', 'proof:create']),
  ports: { /* proof port from edge-adapters */ },
});

// 3. Create gateway
const gateway = createModbusGateway({ runtime, transport });
await gateway.start();

// 4. Read registers
const result = await gateway.readRegisters(1, 0, 10);
console.log(result.data?.values); // [123, 456, ...]

// 5. Or use the sensor bridge for automated polling + proof generation
const bridge = createModbusSensorBridge({
  runtime,
  transport,
  gateway,
  bindings: [
    { sensorId: 'temp-zone-1', unitId: 1, functionCode: 3, address: 0, count: 2, intervalMs: 5000, dataType: 'temperature', unit: '°C' },
    { sensorId: 'pump-status', unitId: 2, functionCode: 1, address: 0, count: 1, intervalMs: 1000, dataType: 'coil' },
  ],
});
await bridge.start();
```

## Transport port

You must implement `ModbusTransportPort`:

| Method | Description |
|--------|-------------|
| `connect()` | Open TCP socket (port 502) or serial port |
| `disconnect()` | Close the connection |
| `sendFrame(frame)` | Send raw Modbus frame bytes, return response bytes |
| `onFrame(handler)` | Register handler for unsolicited/inbound frames |
| `onError(handler)` | Register handler for connection errors |

## Supported function codes

| Code | Name | Gateway method |
|------|------|---------------|
| 1 | Read Coils | `readCoils(unitId, address, count)` |
| 3 | Read Holding Registers | `readRegisters(unitId, address, count)` |
| 4 | Read Input Registers | Via sensor bridge |

## Capabilities

- `transport:modbus` — required for Modbus transport

## License

MIT
