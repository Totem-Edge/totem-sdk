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
| GET + Observe (RFC 7641) | `observe(path, host, port, handler)` |

## Timing

Requests are CON messages and are retransmitted with exponential backoff until
acknowledged, a response arrives, or the request deadline expires.

| Option | Default | Meaning |
|--------|---------|---------|
| `requestTimeoutMs` | `10000` | Overall deadline; retransmission cannot extend it |
| `ackTimeoutMs` | `2000` | Initial retransmission interval; doubles per attempt. `0` disables retransmission |
| `maxRetransmits` | `4` | Upper bound on retransmissions before waiting for the deadline |

```ts
createCoapGateway({ runtime, transport, localPort: 5683, timing: { ackTimeoutMs: 1000 } });
```

An empty ACK stops retransmission and keeps the request pending for a separate
response. Responses are accepted only from the addressed host/port and on the
matching four-byte token; RST and non-2.xx responses settle as failures.

## CBOR payloads

CoAP carries the content format in option 12. `application/cbor` is format 60.
The gateway returns the raw payload plus `contentFormat`, and exports a
minimal RFC 8949 decoder:

```ts
import { decodeCbor } from '@totemsdk/edge-coap';

const result = await gateway.get(['sensors', 'temp'], host, port);
if (result.ok && result.data?.contentFormat === 60) {
  const reading = decodeCbor(result.data.payload); // e.g. { temp: 21.5 }
}
```

`decodeCbor` rejects truncated input, reserved additional information, trailing
bytes, duplicate map keys and nesting beyond 32 levels. Integers above
`Number.MAX_SAFE_INTEGER` decode as `bigint`; tagged values are unwrapped.

The sensor bridge decodes CBOR automatically when a binding's response uses
format 60 and adds `contentFormat`, `observe` (for notifications) and `cbor` to
the proof claims. A payload that claims CBOR but fails to decode is not signed.

## Observations

`observe` registers with the Observe option and keeps the token live after the
initial response. Notifications with a fresh 24-bit sequence are delivered to
the handler; stale duplicates are dropped, confirmable notifications are
acknowledged, and `cancel()` deregisters with `Observe: 1`.

```ts
const registered = await gateway.observe(['sensors', 'temp'], host, port, (notification) => {
  const reading = notification.contentFormat === 60
    ? decodeCbor(notification.payload)
    : notification.payload;
  console.log(notification.observe, reading);
});
if (registered.ok) {
  // later
  await registered.data?.cancel();
}
```

Sensor bindings can use `observe: true` to feed proofs from notifications
instead of polling; if registration is refused the bridge falls back to
interval polling.

## Blockwise transfer (RFC 7959)

Payloads larger than the configured block size are uploaded as Block1
requests, and blockwise responses are assembled transparently:

```ts
const gateway = createCoapGateway({
  runtime, transport, localPort: 5683,
  blockwise: { blockSize: 256, maxBodySize: 1024 * 1024 },
});
const result = await gateway.post(['firmware'], largePayload, host, port);
```

- `blockSize` must be a power of two from 16 to 1024 (default 1024).
- Block1 uploads validate the echoed block number and size; a server that
  reduces the block size mid-transfer fails the request with an explicit error.
- Block2 responses are followed until `more` is clear and assembled up to
  `maxBodySize` (default 1 MiB).
- `get`/`post` return `block1`, `block2`, `size1` and `size2` when present.
- Blockwise observation notifications, multicast and Block1 size
  renegotiation are not implemented.

## Security boundary (OSCORE)

`createCoapGateway({ security })` accepts a `CoapSecurityPort`. The connector
owns framing, correlation and observation semantics; the port owns AEAD, HKDF,
replay windows and OSCORE option encoding.

```ts
import type { CoapSecurityPort } from '@totemsdk/edge-coap';

const security: CoapSecurityPort = reviewedOscoreContext;
const gateway = createCoapGateway({ runtime, transport, localPort: 5683, security });
```

- `protects(host, port)` marks endpoints that must use OSCORE.
- `protect(message)` adds protection and may add the OSCORE option;
  `unprotect(message)` authenticates and decrypts inbound messages.
- The boundary fails closed: a plaintext reply from a protected endpoint is
  dropped, an OSCORE message from an unconfigured endpoint is dropped, and a
  protection failure fails the request before anything is sent. Empty ACK/RST
  messages remain valid because OSCORE does not protect them.

### Node OSCORE context

`createOscoreContext` is a Node.js client-role OSCORE implementation behind the
port. It uses AES-CCM-16-64-128 and HKDF-SHA-256, derives sender/recipient keys
and the common IV per RFC 8613, encodes the OSCORE option, tracks request
Partial IVs for response binding, applies a 32-entry replay window and uses the
FETCH outer code for Observe requests.

```ts
import { createOscoreContext } from '@totemsdk/edge-coap';

const security = await createOscoreContext({
  masterSecret,
  masterSalt,
  senderId,          // e.g. new Uint8Array([0x01])
  recipientId,       // server sender ID
  idContext,         // optional
  endpoints: [{ host: '192.168.1.100', port: 5683 }],
});
const gateway = createCoapGateway({ runtime, transport, localPort: 5683, security });
```

It is validated against RFC 8613 Appendix C test vectors 4–8 (request
protection, responses with and without Partial IV, replay rejection and
authentication failure). Limitations: client requests only (no server-side
response protection), no Class I options, no Uri-Host/Uri-Port/Uri-Query
modeling, and no blockwise/multicast. Supply a different `CoapSecurityPort` for
those profiles.

## Capabilities

- `transport:coap` — required for CoAP transport

## License

Apache-2.0 — see [LICENSE](./LICENSE) and [NOTICE](./NOTICE).


## Native sidecar

`NativeCoapTransport` speaks newline-delimited JSON to the Go bridge on
`COAP_LISTEN_ADDR` (default `127.0.0.1:15003`):

- `send` requests validate the destination and payload, emit the datagram and
  answer immediately (`ok`);
- every inbound datagram is pushed back as a `message` and correlated by the
  gateway's token and endpoint checks;
- `error` pushes cover UDP read failures; an unexpected close rejects pending
  sends and marks the gateway `error`.

The bridge binds UDP on `COAP_BIND_PORT` (`5683` by default; `0` selects an
ephemeral port), exposes `edge-coap --version` (protocol 1) and is documented by
[sidecar.json](./sidecar.json). It is source-built; no binaries are bundled.

## Testing

Tests live outside the published package. Package `test:*` scripts are
repository delegates; tests are not shipped.

- Unit: `tests/unit/edge-coap/` (`npm test`)
- Go bridge validation: `npm run test:go`
- RFC 7252 conformance (fixed vectors, malformed input, token/endpoint
  correlation, retransmission, separate responses, blockwise transfer,
  deadlines): `npm run test:conformance`
- RFC 8613 OSCORE client vectors: `npm run test:oscore`
- Real Go sidecar + independent UDP peer (GET/POST, errors, separate responses,
  blockwise transfer, bridge validation): `npm run test:integration`
- Peer outage, sidecar crash/restart, uncertain pending requests, teardown:
  `npm run test:recovery`
- Packed ESM/CJS consumer with strict type imports: `npm run test:consumer`

## Qualification status

`@totemsdk/edge-coap` is **v1** for the qualified constrained-device profile:
plaintext or OSCORE unicast CoAP with RFC 7252 framing, CON retransmission,
separate responses, token/endpoint correlation, explicit RST/error handling,
deadlines and teardown, CBOR content-format decoding, RFC 7641 observations
feeding signed proof claims, RFC 7959 blockwise transfer and an OSCORE client
and server-role context. Conformance, integration, recovery and
packed-consumer evidence exist for that profile. The shared consumer probe
installs the packed local workspace closure, so sibling publication state does
not block the gate. The support tier remains outside the first-line production
surface.

The OSCORE profile (Node `createOscoreContext`, Appendix C vectors) is
qualified for client and server roles, including Uri-Host/Uri-Port/Uri-Query
handling. Not qualified:

- DTLS (transport-owned);
- blockwise observation notifications and multicast;
- OSCORE Class I options (none are currently defined).

## Next profile

DTLS, blockwise observations and multicast remain outside the qualified
profile. Any security context must stay behind `CoapSecurityPort`; the
connector does not own cryptographic primitives.
