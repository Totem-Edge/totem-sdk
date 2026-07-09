[**@totemsdk/omnia-splice**](../index.md)

***

[@totemsdk/omnia-splice](../index.md) / QuiescedChannel

# Type Alias: QuiescedChannel

> **QuiescedChannel** = `Omit`\<`OmniaChannel`, `"status"`\> & `object`

A channel returned by `quiesceChannel`.

- `status: 'quiesced'` — no new HTLCs may be added until the splice confirms.
- `pendingHTLCs: []` — all resolved HTLCs are cleared from the active list.
- `quiesceSignedState` — the local party's partial signed state over the
  final pre-splice balance split (sequence incremented by one). Exchange this
  with the counterparty to obtain their co-signature before finalizing the splice.

## Type Declaration

### quiesceSignedState

> **quiesceSignedState**: `Partial`\<`SignedChannelState`\>

### status

> **status**: `"quiesced"`
