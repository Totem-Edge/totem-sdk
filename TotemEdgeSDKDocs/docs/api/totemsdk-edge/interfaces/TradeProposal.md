[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / TradeProposal

# Interface: TradeProposal

A role-neutral signed proposal used for:
  - initial buyer proposal
  - seller quote
  - buyer counter
  - seller counter

A counteroffer is NOT a separate protocol object — it is a TradeProposal
with `parentProposalId` set and `round = parent.round + 1`.

## Properties

### createdAt

> **createdAt**: `number`

***

### expiresAt

> **expiresAt**: `number`

***

### manifestId

> **manifestId**: `string`

***

### negotiationId

> **negotiationId**: `string`

***

### parentProposalId?

> `optional` **parentProposalId?**: `string`

***

### proposalId

> **proposalId**: `string`

***

### proposer

> **proposer**: `string`

***

### recipient

> **recipient**: `string`

***

### round

> **round**: `number`

***

### signature

> **signature**: `string`

WOTS signature over the canonical proposal digest.

***

### signerPublicKey

> **signerPublicKey**: `string`

WOTS public-key digest (hex) of the proposer — for verification.

***

### terms

> **terms**: [`TradeTerms`](TradeTerms.md)

***

### version

> **version**: `number`

***

### workAdmission?

> `optional` **workAdmission?**: `MachineWorkAdmissionProof`

Optional Machine Work Admission proof bound to this proposal.
