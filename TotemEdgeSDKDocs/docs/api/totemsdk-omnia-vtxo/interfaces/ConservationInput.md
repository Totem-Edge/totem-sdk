[**@totemsdk/omnia-vtxo**](../index.md)

***

[@totemsdk/omnia-vtxo](../index.md) / ConservationInput

# Interface: ConservationInput

## Properties

### inputs

> **inputs**: [`OmniaVtxo`](OmniaVtxo.md)[]

***

### mode?

> `optional` **mode?**: `"lte"` \| `"strict"`

Conservation mode:
- `'lte'` (default) — outputs may be less than or equal to inputs (allows exit/fee/burn flows)
- `'strict'` — outputs must equal inputs exactly (required for transfer, split, merge)

***

### outputs

> **outputs**: [`OmniaVtxo`](OmniaVtxo.md)[]
