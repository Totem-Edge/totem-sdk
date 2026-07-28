[**@totemsdk/edge-adapters**](../index.md)

***

[@totemsdk/edge-adapters](../index.md) / createManifestPortAdapter

# Function: createManifestPortAdapter()

> **createManifestPortAdapter**(): `EdgeManifestPort`

Wraps @totemsdk/manifest's signManifest / verifyManifest as an EdgeManifestPort.

The port interface already carries seed and keyIndex at call time, so this
adapter has no constructor config — it is purely a thin type bridge.

Callers are responsible for key-lease reservation before calling sign().
This adapter does not interact with @totemsdk/wots-lease.

## Returns

`EdgeManifestPort`
