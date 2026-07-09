[**@totemsdk/omnia-splice**](../index.md)

***

[@totemsdk/omnia-splice](../index.md) / acceptSplice

# Function: acceptSplice()

> **acceptSplice**(`channel`, `proposal`, `leaseProvider`): `Promise`\<[`SpliceAcceptance`](../interfaces/SpliceAcceptance.md)\>

Counterparty accepts a splice proposal by co-signing the splice TX digest.

Requires the channel to be in 'quiesced' state.

WOTS lease safety: reserves a key slot before signing. The returned
`acceptorReservationId` and `acceptorSigningIndices` are embedded in the
`SpliceAcceptance` and consumed by `finalizeSplice` to commit or burn the
acceptor's key-slot reservation.

The acceptor independently:
  1. Validates party membership (proposer and acceptor both in channel).
  2. Validates proposal balance conservation and amount constraints.
  3. Cryptographically binds the signed draft to the proposal params by
     recomputing the expected draft from `params + channel` and comparing
     digests — rejects if they differ (tamper detection).
  4. Reserves a WOTS key slot via `leaseProvider.wotsLease`.
  5. Signs the splice TX digest with reserved indices.

## Parameters

### channel

`OmniaChannel` \| [`QuiescedChannel`](../type-aliases/QuiescedChannel.md)

Quiesced channel.

### proposal

[`SpliceProposal`](../interfaces/SpliceProposal.md)

Splice proposal from the initiating party.

### leaseProvider

[`SpliceLeaseProvider`](../interfaces/SpliceLeaseProvider.md)

Provides the acceptor signer and WOTS lease.

## Returns

`Promise`\<[`SpliceAcceptance`](../interfaces/SpliceAcceptance.md)\>

SpliceAcceptance containing acceptor co-signature and lease data.
