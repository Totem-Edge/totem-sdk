[**@totemsdk/txpow**](../index.md)

***

[@totemsdk/txpow](../index.md) / WorkAdmissionVerification

# Interface: WorkAdmissionVerification

Result of verifying a Machine Work Admission proof.

Three distinct claims, never to be confused:
  A. `valid` — the hash satisfies the challenge target (admission proof).
  B. `superLevel` / `isBlock` — the hash ALSO satisfies the block difficulty
     encoded by the candidate template, yielding an exact Minima Super level.
  C. `broadcastable` — the candidate still corresponds to sufficiently
     current live Minima state AND can be submitted through the relay.

A stale candidate may remain `valid = true` (and `superLevel >= 0`) while
`broadcastable = false`.

`superLevel === -1 ⇔ isBlock === false`, and
`superLevel >= 0 ⇔ isBlock === true`. Verification recomputes these — it
never trusts sender-supplied `isBlock`/`superLevel` metadata.

## Properties

### broadcastable?

> `optional` **broadcastable?**: `boolean`

Level C: isBlock AND the template is current AND a live template provider
was supplied. Undefined in offline mode (no provider) — offline
verification must NOT claim Minima block contribution.

***

### isBlock?

> `optional` **isBlock?**: `boolean`

Level B: superLevel >= 0 (a genuine Minima block).

***

### reason?

> `optional` **reason?**: `string`

***

### superLevel?

> `optional` **superLevel?**: `number`

Level B: exact Minima Super level of the candidate hash.
-1 = not a Minima block; 0..31 = Super-0 … Super-31 block strength.

***

### valid

> **valid**: `boolean`

Level A: the hash satisfies the challenge target.
