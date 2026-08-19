[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / signTxDraft

# Function: signTxDraft()

> **signTxDraft**(`channel`, `draft`, `purpose`, `leaseProvider`, `signer?`): `Promise`\<\{ `indices`: `SigningIndices`; `signature`: `ChannelSignature`; `transactionHex`: `string`; \}\>

Core signing primitive used by both update and settlement paths.
Handles the full wots-lease reserve → sign → commit cycle for any OmniaTxDraft.

The signed digest is the canonical Minima transaction digest, matching the
domain Minima validates in TxPoWChecker.checkSignatures().

## Parameters

### channel

[`OmniaChannel`](../interfaces/OmniaChannel.md)

The channel context (used for treeId and localSigner fallback).

### draft

[`OmniaTxDraft`](../interfaces/OmniaTxDraft.md)

Pre-built TX draft to sign (update TX or settlement TX).

### purpose

`string`

Human-readable purpose label stored with the lease reservation.

### leaseProvider

`WotsLeaseProvider`

WOTS lease provider for key slot reservation/commit.

### signer?

[`ChannelSigner`](../interfaces/ChannelSigner.md)

Optional explicit signer; falls back to channel.localSigner.

## Returns

`Promise`\<\{ `indices`: `SigningIndices`; `signature`: `ChannelSignature`; `transactionHex`: `string`; \}\>
