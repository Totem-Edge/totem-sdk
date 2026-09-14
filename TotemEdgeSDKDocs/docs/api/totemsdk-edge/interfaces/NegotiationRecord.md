[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / NegotiationRecord

# Interface: NegotiationRecord

A single negotiation's tracked state.

## Properties

### agreement?

> `optional` **agreement?**: [`TradeAgreement`](TradeAgreement.md)

The formed agreement (when AGREED).

***

### consumedChallenges

> **consumedChallenges**: `string`[]

Consumed challenge fingerprints (one-shot).

***

### counterparty

> **counterparty**: `string`

Counterparty address.

***

### cumulativeWork

> **cumulativeWork**: `bigint`

Cumulative expected hashes spent in this negotiation.

***

### expiresAt

> **expiresAt**: `number`

Hard negotiation expiry.

***

### headProposalId?

> `optional` **headProposalId?**: `string`

The current proposal head (only this may be accepted/rejected/countered).

***

### lastRound

> **lastRound**: `number`

Round of the last proposal.

***

### manifestId

> **manifestId**: `string`

Manifest this negotiation is over.

***

### negotiationId

> **negotiationId**: `string`

***

### openedAt

> **openedAt**: `number`

When the negotiation was opened.

***

### outstandingChallenges

> **outstandingChallenges**: `object`[]

Outstanding WorkRequired challenges (one per transition/head).

#### challengeId

> **challengeId**: `string`

#### fingerprint

> **fingerprint**: `string`

#### round

> **round**: `number`

#### status

> **status**: `"CANCELLED"` \| `"EXPIRED"` \| `"OUTSTANDING"` \| `"CONSUMED"`

***

### principal

> **principal**: `string`

Authenticated principal (root identity) that opened it.

***

### proposals

> **proposals**: `object`[]

All proposals in this negotiation, in order.

#### proposalId

> **proposalId**: `string`

#### round

> **round**: `number`

#### termsHash

> **termsHash**: `string`

***

### revision

> **revision**: `number`

Monotonically increasing revision for atomic CAS transitions.

***

### state

> **state**: [`NegotiationState`](../type-aliases/NegotiationState.md)

***

### terminalReason?

> `optional` **terminalReason?**: `string`

Terminal reason (when terminal).

***

### termsHashes

> **termsHashes**: `string`[]

Canonical terms hashes of all proposals (for cycle detection).

***

### updatedAt

> **updatedAt**: `number`

When the record was last updated.
