[**@totemsdk/edge-mesh**](../index.md)

***

[@totemsdk/edge-mesh](../index.md) / MeshErrorCode

# Type Alias: MeshErrorCode

> **MeshErrorCode** = `"mtu-too-small"` \| `"frame-too-large"` \| `"too-many-fragments"` \| `"invalid-stream-frame"` \| `"corrupt-frame"`

Typed errors for the edge mesh (RFC-063 P3).

A framed link has two kinds of failure: a caller mistake (bad MTU, frame too
large) and hostile input (a byte stream that does not parse). Callers must be
able to tell them apart without string matching, and relays must be able to
count rejects without swallowing them.
