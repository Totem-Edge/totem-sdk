[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / ChannelSignature

# Type Alias: ChannelSignature

> **ChannelSignature** = `Uint8Array`

Serialized WOTS channel signature. Canonically a serialized hierarchical
`TreeSignature` (`serializeTreeSignature`) — the wallet's unified WOTS scheme
(RFC-037). Legacy flat `wotsSign` output (1088 bytes) is still accepted during
the RFC-037 migration (see `verifyChannelSignature`).
