[**@totemsdk/edge-grpc**](../index.md)

***

[@totemsdk/edge-grpc](../index.md) / GrpcMessage

# Interface: GrpcMessage

## Properties

### isResponse

> **isResponse**: `boolean`

Whether this is a response to a previous request.

***

### path

> **path**: `string`

Fully qualified service/method name (e.g. "/package.Service/Method").

***

### payload

> **payload**: `Uint8Array`

Serialized protobuf payload.

***

### receivedAt

> **receivedAt**: `number`

Timestamp of receipt.

***

### requestId?

> `optional` **requestId?**: `string`

Correlation ID for request/response matching.
