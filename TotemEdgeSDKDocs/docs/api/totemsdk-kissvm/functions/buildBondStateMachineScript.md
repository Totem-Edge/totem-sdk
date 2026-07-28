[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / buildBondStateMachineScript

# Function: buildBondStateMachineScript()

> **buildBondStateMachineScript**(`config`): `string`

Build a bond state machine script enforcing the 7-status lifecycle:
  declared → pending → active → expiring → expired
                            ↘ disputed → invalid

Port layout:
  0 — bond status
  1 — bond amount
  2 — expiresAt block
  3 — heartbeat block
  4 — SLA port
  5 — probe signer pk
  6 — current block

## Parameters

### config

[`ProviderBondConfig`](../interfaces/ProviderBondConfig.md)

## Returns

`string`
