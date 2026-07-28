# @totemsdk/edge-grpc

Edge runtime adapter for gRPC — service-to-service, cloud-to-edge control planes.

## Install

```bash
npm install @totemsdk/edge-grpc
```

## Design

Uses `@totemsdk/stream-transport`'s `IStreamTransport` for the underlying bidirectional byte pipe. gRPC framing (1-byte compression flag + 4-byte BE length + JSON header + protobuf body) is handled by this package. The caller provides the transport and protobuf codec.

## Quick start

```ts
import { createEdgeRuntime, createEdgeDevice, createCapabilitySet } from '@totemsdk/edge';
import { createGrpcGateway, createGrpcSensorBridge } from '@totemsdk/edge-grpc';
import { WebSocketTransport } from '@totemsdk/stream-transport';

// 1. Create transport
const ws = new WebSocket('wss://grpc.example.com');
const transport = new WebSocketTransport(ws);

// 2. Wire into Edge runtime
const runtime = createEdgeRuntime({
  deviceId: 'grpc-gateway-01',
  capabilities: createCapabilitySet(['transport:grpc', 'proof:create']),
  ports: { /* proof port */ },
});

// 3. Create gateway
const gateway = createGrpcGateway({ runtime, transport });
await gateway.start();

// 4. Make a unary call
const result = await gateway.call('/sensors.Temperature/Read', new Uint8Array(0));
console.log(result.data?.payload);

// 5. Or use the sensor bridge for automated polling
const bridge = createGrpcSensorBridge({
  runtime,
  transport,
  gateway,
  bindings: [
    { sensorId: 'temp-sensor', path: '/sensors.Temperature/Read', intervalMs: 5000 },
  ],
});
await bridge.start();
```

## Wire format

```
[1 byte: compression flag (0 = none)]
[4 bytes BE uint32: body length]
[N bytes: JSON header + \0 + protobuf payload]
```

JSON header: `{ "path": "/package.Service/Method", "requestId": "0", "isResponse": false }`

## Capabilities

- `transport:grpc` — required for gRPC transport

## License

MIT
