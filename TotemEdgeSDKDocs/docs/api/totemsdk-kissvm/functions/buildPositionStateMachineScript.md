[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / buildPositionStateMachineScript

# Function: buildPositionStateMachineScript()

> **buildPositionStateMachineScript**(`config`): `string`

Build a position state machine script enforcing the position lifecycle:
  draft → committed → active → quiescing → withdrawn
             ↘ depleted    ↘ depleted
             ↘ invalid      ↘ invalid
                            ↘ disputed
Port 0 holds the status.

## Parameters

### config

#### governancePk

`string`

## Returns

`string`
