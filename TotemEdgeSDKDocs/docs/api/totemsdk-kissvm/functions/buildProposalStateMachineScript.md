[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / buildProposalStateMachineScript

# Function: buildProposalStateMachineScript()

> **buildProposalStateMachineScript**(`config`): `string`

Build a proposal state-machine script that enforces the full
7-status lifecycle: draft → active → passed → failed → executed
                                      ↘ cancelled  (from any except executed)
                                      ↘ expired    (from active, after votingEndsAt)

Port layout (STATE / PREVSTATE):
  0 — status
  1 — votingStartsAt (block)
  2 — votingEndsAt   (block)
  3 — executionDelay (blocks)
  4 — proposer pk hex

## Parameters

### config

[`ProposalConfig`](../interfaces/ProposalConfig.md)

## Returns

`string`
