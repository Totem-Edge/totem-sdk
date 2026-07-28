[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / buildVoteSubmissionScript

# Function: buildVoteSubmissionScript()

> **buildVoteSubmissionScript**(`config`): `string`

Build a vote-submission script that enforces:
  1. Voting window is open (block between votingStartsAt and votingEndsAt)
  2. Voter is in the membership snapshot (weight > 0)
  3. No double vote (nonce spent via INC)
  4. Vote weight matches attested membership weight
  5. Choice is valid (yes/no/abstain, mutually exclusive)

Port layout (STATE / PREVSTATE):
  0 — voter pk (hex, committed on first vote submit)
  1 — nonce (incremented each vote to prevent replay)
  2 — attested membership weight
  3 — choice (0=yes, 1=no, 2=abstain)
  4 — vote weight submitted
  5 — membership snapshot hash anchor

## Parameters

### config

[`VoteSubmissionConfig`](../interfaces/VoteSubmissionConfig.md)

## Returns

`string`
