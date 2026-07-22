# @totemsdk/edge-connectors

**Consolidated edge protocol adapters for Totem SDK.**

Replaces the 10 individual stub adapter packages (`edge-bacnet`, `edge-ble`, `edge-can`, `edge-coap`, `edge-grpc`, `edge-lorawan`, `edge-matter`, `edge-modbus`, `edge-opcua`, `edge-ros2`) with a single package.

Each adapter provides a transport interface plus KISSVM policy templates for device authorization, command execution, and data verification.

**Status: v0.1 — experimental, not audited.**

## Install

```bash
npm install @totemsdk/edge-connectors
```

## Adapters

| Adapter | Protocol | Use case |
|---------|----------|----------|
| `bacnet` | BACnet | Building automation, HVAC, lighting |
| `ble` | Bluetooth LE | Wearables, beacons, medical devices |
| `can` | CAN bus | Vehicles, industrial machinery |
| `coap` | CoAP | Constrained IoT devices |
| `grpc` | gRPC | High-performance microservices |
| `lorawan` | LoRaWAN | Long-range, low-power sensors |
| `matter` | Matter | Smart home interoperability |
| `modbus` | Modbus | PLCs, industrial controllers |
| `opcua` | OPC-UA | Factory automation, SCADA |
| `ros2` | ROS 2 | Robotics, autonomous systems |

## Usage

```ts
import { createTransport, type AdapterType, type TransportConfig } from '@totemsdk/edge-connectors';

const transport = createTransport('modbus', {
  host: '192.168.1.100',
  port: 502,
});
const result = await transport.send({ command: 'READ_COIL', address: 0, quantity: 1 });
```

Each adapter provides typed request/response schemas and optional KISSVM policy enforcement.

## License

MIT
