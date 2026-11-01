# @totemsdk/edge-grpc

Edge runtime adapter for gRPC — service-to-service, cloud-to-edge control planes.

## Install

```bash
npm install @totemsdk/edge-grpc
```

## Design

The TypeScript package speaks newline-delimited JSON to a Go proxy over a local
TCP socket. The proxy owns the real gRPC/HTTP2 connection, raw-byte codec,
TLS and metadata authentication. Protobuf payloads are passed through as bytes;
no generated stubs are required.

Each TypeScript client gets its own gRPC connection and stream namespace.
Stream pushes are delivered only to the owning connection.

## Quick start

```ts
import { createGrpcGateway, NativeGrpcTransport } from '@totemsdk/edge-grpc';

const client = new NativeGrpcTransport({
  port: 15005,
  tls: { caCert, serverName: 'grpc.example.com' },
  metadata: { authorization: 'Bearer …' },
});

const gateway = createGrpcGateway({
  runtime,
  client,
  address: 'grpc.example.com:443',
});

await gateway.start(); // dials through the sidecar

const unary = await gateway.call('/sensors.Temperature/Read', requestBytes);
const opened = await gateway.openServerStream('/sensors.Temperature/Watch', requestBytes);
if (opened.ok) opened.data.onData((chunk) => { /* … */ });
```

### Streams

| Method | Direction | `close()` behaviour |
|--------|-----------|---------------------|
| `openServerStream` | server → client | cancels the RPC |
| `openClientStream` | client → server | half-closes the send side; the single response is delivered as stream data |
| `openBidiStream` | both | half-closes the send side; remaining responses are delivered until the server ends |

`onData`/`onEnd`/`onError` may be attached after `open*` resolves: pushes that
arrive first are buffered and replayed. gRPC status codes are preserved on
errors (`code`), and a deadline passed to `call`/`open*` becomes the RPC
deadline.

### TLS and authentication

`NativeGrpcTransport` accepts:

- `tls.caCert` — PEM CA bundle (system roots when omitted);
- `tls.cert` / `tls.key` — PEM client certificate for mutual TLS;
- `tls.serverName` — SNI/verification name when dialing an IP;
- `tls.insecureSkipVerify` — test/profile use only;
- `authority` — HTTP/2 authority override;
- `metadata` — connection-level metadata, e.g. `authorization`.

## Wire format (TypeScript ↔ proxy)

Requests and responses are newline-delimited JSON with base64 payloads:

```json
{ "id": "grpc-1", "type": "unary", "path": "/pkg.Service/Method", "payload": "AQI=", "deadline_ms": 5000 }
{ "id": "grpc-1", "ok": true, "data": "AQI=" }
```

Stream pushes use `stream_data`, `stream_end` and `stream_error` messages.
The proxy rejects invalid method paths, malformed base64, oversized payloads,
unknown request types and out-of-sequence stream operations.

## Native sidecar

`sidecar.json` documents the source-build contract:

```bash
pnpm --filter @totemsdk/edge-grpc build:go
GRPC_LISTEN_ADDR=127.0.0.1:15005 ./bin/edge-grpc
```

`edge-grpc --version` reports protocol 1. The npm package does not bundle
platform binaries.

## Qualification status

`@totemsdk/edge-grpc` is **RC**. The qualified profile covers raw-byte unary
and server/client/bidi streaming over TLS with metadata authentication,
deadline propagation, cancellation, per-client stream ownership and
crash/restart recovery. Conformance, integration, recovery and packed-consumer
evidence run in CI.

Not qualified: reflection/health checking, generated stubs, retry policies,
load balancing, connection pooling and prebuilt sidecar binaries.

## Testing

Tests live outside the published package. Package `test:*` scripts are
repository delegates; tests are not shipped.

- Unit: `tests/unit/edge-grpc/` (`npm test`)
- Go codec/protocol: `npm run test:go`
- Protocol conformance (malformed/out-of-sequence requests):
  `npm run test:conformance`
- Real TLS gRPC server (unary, all stream kinds, deadlines, auth, cancellation):
  `npm run test:integration`
- Proxy crash/restart, pending calls, stream errors and teardown:
  `npm run test:recovery`
- Packed ESM/CJS consumer with strict type imports: `npm run test:consumer`

## Capabilities

- `transport:grpc` — required for gRPC transport

## License

Apache-2.0 — see [LICENSE](./LICENSE) and [NOTICE](./NOTICE).
