[**@totemsdk/txpow**](../index.md)

***

[@totemsdk/txpow](../index.md) / computeActionCommitment

# Function: computeActionCommitment()

> **computeActionCommitment**(`action`, `challenge`): `string`

Compute the canonical action commitment.

commitment = SHA3-256(
  protocolDomain || protocolVersion ||
  canonicalAction(action) || canonicalChallenge(challenge)
)

## Parameters

### action

[`MachineWorkAction`](../interfaces/MachineWorkAction.md)

The application action.

### challenge

[`WorkChallenge`](../interfaces/WorkChallenge.md)

The challenge the work is bound to.

## Returns

`string`
