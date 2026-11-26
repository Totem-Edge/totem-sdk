[**@totemsdk/lookup-protocol**](../index.md)

***

[@totemsdk/lookup-protocol](../index.md) / ReplicationCapability

# Interface: ReplicationCapability

## Properties

### datasetId

> **datasetId**: `string`

***

### datasetVersion

> **datasetVersion**: `number`

***

### encrypted

> **encrypted**: `boolean`

***

### endpoint?

> `optional` **endpoint?**: `string`

Optional opaque endpoint/topic hint; never trusted as identity.

***

### transports

> **transports**: (`"hyperswarm"` \| `"relay"`)[]

***

### writerModel

> **writerModel**: `"single-writer"` \| `"multi-writer"` \| `"read-replica"`
