[**@totemsdk/edge-grpc**](../index.md)

***

[@totemsdk/edge-grpc](../index.md) / GrpcTlsConfig

# Interface: GrpcTlsConfig

## Properties

### caCert?

> `optional` **caCert?**: `string`

PEM-encoded CA bundle. Defaults to the system roots.

***

### cert?

> `optional` **cert?**: `string`

PEM-encoded client certificate for mutual TLS.

***

### insecureSkipVerify?

> `optional` **insecureSkipVerify?**: `boolean`

Disable certificate verification (test/profile use only).

***

### key?

> `optional` **key?**: `string`

PEM-encoded client private key.

***

### serverName?

> `optional` **serverName?**: `string`

TLS server name (SNI) when the dial address is an IP.
