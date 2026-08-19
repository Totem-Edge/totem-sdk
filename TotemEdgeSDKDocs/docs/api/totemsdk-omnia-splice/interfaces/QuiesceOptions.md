[**@totemsdk/omnia-splice**](../index.md)

***

[@totemsdk/omnia-splice](../index.md) / QuiesceOptions

# Interface: QuiesceOptions

Options for `quiesceChannel`.

## Properties

### awaitResolution?

> `optional` **awaitResolution?**: (`pending`) => `Promise`\<`void`\>

Called when the channel has pending HTLCs that have not yet reached a
terminal state (`fulfilled` or `timed_out`). If provided, `quiesceChannel`
invokes this callback with the still-pending HTLCs, giving the caller an
opportunity to drive resolution — e.g. submit preimage reveals, wait for
timeout blocks, or poll a Minima node — before the quiesce is retried.

After the callback resolves, `channel.pendingHTLCs` is re-inspected.  If
all HTLCs have moved to a terminal state the quiesce proceeds; if any are
still pending, `PendingHTLCError` is thrown.

If this option is not provided, `PendingHTLCError` is thrown immediately
when pending HTLCs are found.

#### Parameters

##### pending

`HTLCRecord`[]

The HTLCs that still need resolution.

#### Returns

`Promise`\<`void`\>
