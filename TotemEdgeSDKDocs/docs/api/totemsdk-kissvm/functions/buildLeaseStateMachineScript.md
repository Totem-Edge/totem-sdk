[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / buildLeaseStateMachineScript

# Function: buildLeaseStateMachineScript()

> **buildLeaseStateMachineScript**(`config`): `string`

Build a lease state machine script enforcing the 5-status lifecycle:
  pending → active → expired
                 ↘ finalised
                 ↘ cancelled

Port 0 holds the status.

## Parameters

### config

[`LeaseCertificateConfig`](../interfaces/LeaseCertificateConfig.md)

## Returns

`string`
