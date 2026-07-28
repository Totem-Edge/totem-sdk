[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / buildActionStateMachineScript

# Function: buildActionStateMachineScript()

> **buildActionStateMachineScript**(`config`): `string`

Build an industrial action state machine script that enforces:
  proposed → noticed (require >= minNoticeBlocks from noticePort)
  noticed → active (require >= minNotice and <= maxDuration from noticePort)
  noticed → resolved (authority sig)
  active → resolved (authority sig)
  active → escalated (authority sig)
  noticed → expired (block > expiry)

## Parameters

### config

[`ActionStateMachineConfig`](../interfaces/ActionStateMachineConfig.md)

## Returns

`string`
