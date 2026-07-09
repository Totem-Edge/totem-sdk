[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / signState

# Function: signState()

> **signState**(`channel`, `update`, `leaseProvider`, `signer?`): `Promise`\<`Partial`\<[`SignedChannelState`](../interfaces/SignedChannelState.md)\>\>

Signs a channel update state and returns the full partial `SignedChannelState`.

Signs the FULL state commitment — SHA3-256( sequence ‖ sorted-balances ‖ pending-HTLCs ) —
NOT just the on-chain TX draft digest. This is critical because `buildUpdateTx` only
encodes the UTXO total on-chain (eltoo design); the per-party balance split is purely
off-chain. If the signature covered only the TX draft, an adversary could tamper with
balance/HTLC fields in a `SignedChannelState` while the WOTS signature remained valid,
breaking dispute evidence integrity.

The same `computeStateCommitment` is used by `verifyStateSignature` and the module-level
watermark check — single source of truth for what is signed.

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

### leaseProvider

`WotsLeaseProvider`

WOTS lease provider.

### signer?

[`ChannelSigner`](../interfaces/ChannelSigner.md)

Optional explicit signer; falls back to channel.localSigner.

## Returns

`Promise`\<`Partial`\<[`SignedChannelState`](../interfaces/SignedChannelState.md)\>\>
