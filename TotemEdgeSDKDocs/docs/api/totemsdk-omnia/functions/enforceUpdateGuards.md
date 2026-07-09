[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / enforceUpdateGuards

# Function: enforceUpdateGuards()

> **enforceUpdateGuards**(`channelId`, `newSequence`, `payloadHash`): `"CAPACITY_NEAR_EXHAUSTION"` \| `null`

Enforce all per-update invariants that must hold for every state transition
regardless of whether the caller is `updateState`, `addHTLC`, `fulfillHTLC`,
or `timeoutHTLC`.

Specifically:
  1. WOTS capacity check: throws `ChannelCapacityError` at 100%, returns
     `'CAPACITY_NEAR_EXHAUSTION'` at 95% (caller must NOT advance watermark).
  2. Stale-sequence guard (SequenceError): rejects any attempt to sign a
     sequence that is behind the module-level watermark.
  3. Double-sign guard (DoubleSignError): rejects a different payload at a
     sequence already committed by this process.
  4. Watermark advance: after all guards pass, records `(newSequence,
     payloadHash)` synchronously — before any async work — so no concurrent
     call can slip in between the guard and the WOTS reservation.

## Parameters

### channelId

`string`

Channel identifier for the watermark map key.

### newSequence

`number`

Proposed next sequence number.

### payloadHash

`string`

Hex-encoded SHA3-256 of the full off-chain state
                    commitment (sequence + balances + pending HTLCs).

## Returns

`"CAPACITY_NEAR_EXHAUSTION"` \| `null`

`'CAPACITY_NEAR_EXHAUSTION'` when signing is blocked at the 95%
         threshold; `null` when signing may proceed.
