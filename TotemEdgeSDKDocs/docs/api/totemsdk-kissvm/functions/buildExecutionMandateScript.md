[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / buildExecutionMandateScript

# Function: buildExecutionMandateScript()

> **buildExecutionMandateScript**(`config`): `string`

Build an execution-mandate script that enforces:
  1. Timelock: current block > votingEndsAt + executionDelay
  2. Outcome proof committed and verified on-chain
  3. Vote tally hash matches the committed outcome
  4. Membership snapshot hash matches the proposal
  5. Governance multisig threshold must authorize execution
  6. Single-use enforcement via INC nonce

Port layout:
  0 — execution nonce (for single-use replay protection)
  1 — outcomeProofId (committed hash bytes)
  2 — voteTallyHash (committed hash bytes)
  3 — membershipSnapshotHash (committed hash bytes)
  4 — votingEndsAt (block, from proposal anchor)
  5 — executionDelay (blocks, from proposal anchor)

## Parameters

### config

[`ExecutionMandateConfig`](../interfaces/ExecutionMandateConfig.md)

## Returns

`string`
