[**@totemsdk/omnia-splice**](../index.md)

***

[@totemsdk/omnia-splice](../index.md) / quiesceChannel

# Function: quiesceChannel()

> **quiesceChannel**(`channel`, `leaseProvider`, `options?`): `Promise`\<[`QuiescedChannel`](../type-aliases/QuiescedChannel.md)\>

Quiesce a channel before splicing.

Quiescing is mandatory before a splice can be proposed or accepted. It:
  1. Validates the channel is `'active'`.
  2. Ensures all in-flight HTLCs have reached a terminal state
     (`fulfilled` or `timed_out`). If pending HTLCs exist and
     `options.awaitResolution` is provided, the callback is invoked so the
     caller can drive/await resolution (submit preimages, wait for timeouts,
     poll a node). After the callback the channel is re-checked. If HTLCs
     remain pending, `PendingHTLCError` is thrown. If the option is absent
     and pending HTLCs exist, `PendingHTLCError` is thrown immediately.
  3. Signs a final state update (via `updateState`) that captures the settled
     balance split at `currentSequence + 1`. This produces a WOTS-signed
     `Partial<SignedChannelState>` binding both parties to the pre-splice
     balance before the splice TX resets the sequence to 0.
  4. Returns a `QuiescedChannel` with `status: 'quiesced'`, `pendingHTLCs: []`
     (all resolved HTLCs cleared), and `quiesceSignedState` containing the
     local party's partial signature over the final balance state.

The caller must exchange `quiesceSignedState` with the counterparty to obtain
their co-signature, providing a fully signed record of the last pre-splice
balance for any future dispute resolution.

## Parameters

### channel

`OmniaChannel`

The active channel to quiesce.

### leaseProvider

[`SpliceLeaseProvider`](../interfaces/SpliceLeaseProvider.md)

Provides the local party's signer and WOTS lease.

### options?

[`QuiesceOptions`](../interfaces/QuiesceOptions.md)

Optional: `awaitResolution` callback for HTLC settlement.

## Returns

`Promise`\<[`QuiescedChannel`](../type-aliases/QuiescedChannel.md)\>

A QuiescedChannel with `status: 'quiesced'`, cleared `pendingHTLCs`,
         and the local party's partial signature over the final balance state.

## Throws

If channel is not active.

## Throws

If HTLCs remain pending after resolution.
