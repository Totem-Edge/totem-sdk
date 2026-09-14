[**@totemsdk/txpow**](../index.md)

***

[@totemsdk/txpow](../index.md) / templateFreshness

# Function: templateFreshness()

> **templateFreshness**(`template`, `latest`, `options?`): `object`

Default staleness policy: a template is "current enough" for admission if it
was captured within the window, and "current" for L1 broadcast if it matches
the latest template id.

## Parameters

### template

[`MinimaWorkTemplate`](../interfaces/MinimaWorkTemplate.md)

### latest

[`MinimaWorkTemplate`](../interfaces/MinimaWorkTemplate.md) \| `null`

### options?

#### admissionWindowMs?

`number`

#### now?

`number`

## Returns

`object`

### admissionValid

> **admissionValid**: `boolean`

### broadcastable

> **broadcastable**: `boolean`
