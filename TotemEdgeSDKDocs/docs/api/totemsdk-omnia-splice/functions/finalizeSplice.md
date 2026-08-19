[**@totemsdk/omnia-splice**](../index.md)

***

[@totemsdk/omnia-splice](../index.md) / finalizeSplice

# Function: finalizeSplice()

> **finalizeSplice**(`channel`, `proposal`, `acceptance`, `options?`): `Promise`\<[`SplicedChannel`](../type-aliases/SplicedChannel.md)\>

Finalize a splice by assembling both parties' signatures, mining PoW,
optionally broadcasting the TX, and returning the new active channel.

**Quiesce gate**: the channel must be in `'quiesced'` state. Call
`quiesceChannel` first to settle all HTLCs and sign the pre-splice state.

**Security checks** (all verified before mining):
 1. `channel.status === 'quiesced'`
 2. `proposal.spliceId === acceptance.spliceId`
 3. `proposal.channelId` and `acceptance.channelId` match `channel.channelId`
 4. Proposer and acceptor are distinct, non-empty-keyed channel parties
 5. Both signatures are non-empty byte arrays
 6. Both signatures pass cryptographic verification against the splice TX
    digest (WOTS by default; override with `options.verifySignature` in tests)
 7. `spliceTxDraft` digest matches what `buildSpliceTx(channel, params)` produces

**WOTS lease lifecycle**:
 - If `options.proposerLeaseProvider` is supplied: `commitKeyUse` is called
   after a confirmed splice TX, or `burnReservation` on failure.
 - Same for `options.acceptorLeaseProvider`.
 - Reservations are tracked independently; only uncommitted ones are burned.

**Broadcast failure**: if `broadcast()` returns `{ success: false }` without
a `txpowid`, `finalizeSplice` throws and burns any open reservations.

**Side effect**: the `channel` object passed in is mutated to
`status: 'spliced'` after a successful finalize. This marks the old
quiesced channel as invalid; only the returned `SplicedChannel` is live.

**Returned SplicedChannel**:
 - `status: 'active'`          — ready for new payments immediately
 - `totalValue`                 — updated to `proposal.params.newTotalValue`
 - `balances`                   — updated to `proposal.params.newBalances`
 - `currentSequence: 0`         — fresh WOTS budget
 - `latestState: null`          — no cosigned state yet
 - `splicedFrom`                — old channel's `channelId`
 - `spliceFundingTxId`          — mined (or broadcast) TX ID
 - `spliceFundingCoinId`        — `<txId>-0`

## Parameters

### channel

`OmniaChannel` \| [`QuiescedChannel`](../type-aliases/QuiescedChannel.md)

Quiesced channel (mutated to 'spliced' on success).

### proposal

[`SpliceProposal`](../interfaces/SpliceProposal.md)

Splice proposal from the initiating party.

### acceptance

[`SpliceAcceptance`](../interfaces/SpliceAcceptance.md)

Co-signature from the accepting party.

### options?

[`FinalizeSpliceOptions`](../interfaces/FinalizeSpliceOptions.md)

Broadcast, difficulty, verifier, and lease providers.

## Returns

`Promise`\<[`SplicedChannel`](../type-aliases/SplicedChannel.md)\>

SplicedChannel (`status: 'active'`) with updated value and provenance.
