[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / signState

# Function: signState()

> **signState**(`channel`, `update`, `leaseProvider`, `signer?`): `Promise`\<`Partial`\<[`SignedChannelState`](../interfaces/SignedChannelState.md)\>\>

Signs a channel update state and returns the full partial `SignedChannelState`.

Signs the canonical Minima update transaction digest. The full off-chain state
is bound through StateCommitmentV2 embedded in STATE(102), making the digest
both L1-visible and KISSVM-visible.

Executes the full reserve → sign → commit WOTS lease cycle and returns a
`Partial<SignedChannelState>` with `signatures` and `signingIndices` keyed by the
signer's `partyId`, ready to be forwarded to the counterparty for co-signing.

## Parameters

### channel

[`OmniaChannel`](../interfaces/OmniaChannel.md)

The channel context (used for treeId, localSigner fallback, pendingHTLCs).

### update

New sequence number and balance split for this state.

#### newBalances

`Record`\<`string`, `bigint`\>

#### newSequence

`number`

#### programTransition?

[`ProgramTransition`](../interfaces/ProgramTransition.md)

### leaseProvider

`WotsLeaseProvider`

WOTS lease provider.

### signer?

[`ChannelSigner`](../interfaces/ChannelSigner.md)

Optional explicit signer; falls back to channel.localSigner.

## Returns

`Promise`\<`Partial`\<[`SignedChannelState`](../interfaces/SignedChannelState.md)\>\>
