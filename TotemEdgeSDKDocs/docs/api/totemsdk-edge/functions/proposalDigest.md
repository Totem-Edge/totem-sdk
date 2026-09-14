[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / proposalDigest

# Function: proposalDigest()

> **proposalDigest**(`proposal`): `string`

Canonical digest of a TradeProposal (excluding the signature and the
signer public key, which are not part of the signed content).

Binds: version, proposalId, negotiationId, parentProposalId, round,
manifestId, proposer, recipient, terms, createdAt, expiresAt.

## Parameters

### proposal

`Omit`\<[`TradeProposal`](../interfaces/TradeProposal.md), `"signature"` \| `"signerPublicKey"`\>

## Returns

`string`
