[**@totemsdk/connect**](../index.md)

***

[@totemsdk/connect](../index.md) / OmniaSupportProbe

# Interface: OmniaSupportProbe

RFC-035 B5 — derive the coarse `omnia` capability block from what the wallet's
Omnia port will actually attempt.

The capability manifest is a claim about behaviour, and the same wallet build
runs in two very different modes: self-hosted (WOTS lease material present, so
signing-required operations work) and Axia lease mode (no signing material).
A static block either over-claims in Axia mode or under-claims in self-hosted
mode; deriving it from the port's `supports()` probe is truthful in both.

## Methods

### supports()?

> `optional` **supports**(`method`): `boolean` \| \{ `reason?`: `string`; `supported`: `boolean`; \}

#### Parameters

##### method

`string`

#### Returns

`boolean` \| \{ `reason?`: `string`; `supported`: `boolean`; \}
