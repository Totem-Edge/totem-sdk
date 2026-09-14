[**@totemsdk/txpow**](../index.md)

***

[@totemsdk/txpow](../index.md) / VerifyWorkAdmissionOptions

# Interface: VerifyWorkAdmissionOptions

## Properties

### admissionWindowMs?

> `optional` **admissionWindowMs?**: `number`

Staleness window (ms) within which a template is acceptable for admission.

***

### latestTemplate?

> `optional` **latestTemplate?**: [`MinimaWorkTemplate`](MinimaWorkTemplate.md) \| `null`

The latest template, for broadcastability checks.

***

### now?

> `optional` **now?**: `number`

Override the current time for deterministic testing.
