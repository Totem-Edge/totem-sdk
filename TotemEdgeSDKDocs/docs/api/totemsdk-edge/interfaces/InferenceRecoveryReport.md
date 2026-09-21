[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / InferenceRecoveryReport

# Interface: InferenceRecoveryReport

Recovery view of the journal (Phase 3a accounting-recovery gate).

## Properties

### completed

> `readonly` **completed**: readonly [`InferenceReadEvent`](../type-aliases/InferenceReadEvent.md)[]

`finished` events whose outcome is definitively `completed`.

***

### interrupted

> `readonly` **interrupted**: readonly [`InferenceReadEvent`](../type-aliases/InferenceReadEvent.md)[]

`started` events with no `finished` — the process died (or the journal
was written for a call that never dispatched anything else). These are
*interrupted*: never re-run, never receipted, budget held.
