[**@totemsdk/edge-mesh**](../index.md)

***

[@totemsdk/edge-mesh](../index.md) / MeshRejectSink

# Type Alias: MeshRejectSink

> **MeshRejectSink** = (`reason`) => `void`

Called for every dropped packet. Relays should count these: silent drops make
a hostile or broken peer indistinguishable from an idle link.

## Parameters

### reason

[`MeshRejectReason`](MeshRejectReason.md)

## Returns

`void`
