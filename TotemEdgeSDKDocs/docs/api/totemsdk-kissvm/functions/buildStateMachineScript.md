[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / buildStateMachineScript

# Function: buildStateMachineScript()

> **buildStateMachineScript**(`config`): `string`

Build a KISSVM state machine script.

The script:
  1. Reads current state from STATE(port)
  2. Reads previous state from PREVSTATE(port)
  3. Validates the transition is allowed
  4. Verifies operator authorization
  5. Preserves the new state

## Parameters

### config

[`StateMachineConfig`](../interfaces/StateMachineConfig.md)

## Returns

`string`
