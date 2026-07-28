# @totemsdk/edge-coap

Edge runtime adapter for CoAP — constrained devices, RFC 7252, UDP transport.

## Install

```bash
npm install @totemsdk/edge-coap
```

## Design

This package does **not** import `dgram`, `coap`, or any UDP library. All network behaviour is injected via `CoapTransportPort`. The package handles CoAP framing (CON/NON/ACK/RST, options, tokens) and request/response matching.

## Quick start

```ts
import { createEdgeRuntime, createEdgeDevice, createCapabilitySet } from '@totemsdk/edge';
import { createCoapGateway, createCoapSensorBridge } from '@totemsdk/edge-coap';
import type { CoapTransportPort } from '@totemsdk/edge-coap';

// 1. Implement CoapTransportPort
const transport: CoapTransportPort = {
  async bind(port) { /* bind UDP socket */ },
  async close() { /* close socket */ },
  async send(host, port, message) { /* send UDP datagram */ },
  onMessage(handler) { /* register inbound handler */ return () => {}; },
  onError(handler) { /* register error handler */ return () => {}; },
};

// 2. Wire into Edge runtime
const runtime = createEdgeRuntime({
  deviceId: 'coap-gateway-01',
  capabilities: createCapabilitySet(['transport:coap', 'proof:create']),
  ports: { /* proof port */ },
});

// 3. Create gateway
const gateway = createCoapGateway({ runtime, transport, localPort: 5683 });
await gateway.start();

// 4. GET a resource
const result = await gateway.get(['sensors', 'temperature'], '192.168.1.100', 5683);
console.log(result.data?.payload);

// 5. POST to a resource
await gateway.post(['actuators', 'valve'], new TextEncoder().encode('open'), '192.168.1.101', 5683);

// 6. Or use the sensor bridge for automated polling
const bridge = createCoapSensorBridge({
  runtime,
  transport,
  gateway,
  bindings: [
    { sensorId: 'temp-1', path: ['sensors', 'temperature'], host: '192.168.1.100', port: 5683, intervalMs: 5000 },
  ],
});
await bridge.start();
```

## Transport port

| Method | Description |
|--------|-------------|
| `bind(port)` | Bind UDP socket to local port |
| `close()` | Close the socket |
| `send(host, port, message)` | Send CoAP message bytes to remote endpoint |
| `onMessage(handler)` | Register handler for inbound messages with remote address |
| `onError(handler)` | Register handler for socket errors |

## Supported methods

| Method | Gateway method |
|--------|---------------|
| GET | `get(path, host, port)` |
| POST | `post(path, payload, host, port)` |

## Capabilities

- `transport:coap` — required for CoAP transport

## License

MIT
