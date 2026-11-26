[**@totemsdk/omnia-router**](../index.md)

***

[@totemsdk/omnia-router](../index.md) / buildAuthenticatedRouterFeeProof

# Function: buildAuthenticatedRouterFeeProof()

> **buildAuthenticatedRouterFeeProof**(`channel`, `htlc`, `transition`, `options?`): [`RouterFeeProof`](../interfaces/RouterFeeProof.md)

OMN-083: build a fee proof bound to the authenticated transition that settled
the HTLC.

The proof carries both state commitments, the exact balance delta the
recipient received, and the fee the intermediary retained. A hash over
descriptive fields proves only that the caller's numbers are self-consistent;
this proves the payment happened on this channel.

## Parameters

### channel

[`RouterChannel`](../interfaces/RouterChannel.md)

### htlc

[`ChannelHTLC`](../interfaces/ChannelHTLC.md)

### transition

[`RouterStateTransition`](../interfaces/RouterStateTransition.md)

### options?

#### feeAmount?

`bigint`

#### settledAt?

`number`

## Returns

[`RouterFeeProof`](../interfaces/RouterFeeProof.md)
