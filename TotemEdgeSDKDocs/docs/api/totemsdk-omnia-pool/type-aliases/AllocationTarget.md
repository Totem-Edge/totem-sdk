[**@totemsdk/omnia-pool**](../index.md)

***

[@totemsdk/omnia-pool](../index.md) / AllocationTarget

# Type Alias: AllocationTarget

> **AllocationTarget** = \{ `params`: `CreateChannelParams`; `type`: `"channel"`; \} \| \{ `params`: `FactoryCreationParams`; `type`: `"factory"`; \} \| \{ `channel`: `RouterChannel`; `type`: `"router"`; \} \| \{ `params`: `MintVtxoParams`; `pool`: `OmniaVtxoPool`; `type`: `"vtxo"`; \} \| \{ `purpose`: `string`; `type`: `"reserve"`; \}

Convenience type for allocation targets.
