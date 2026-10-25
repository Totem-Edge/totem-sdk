[**@totemsdk/chain-provider**](../index.md)

***

[@totemsdk/chain-provider](../index.md) / assertConsentedNodeUrl

# Function: assertConsentedNodeUrl()

> **assertConsentedNodeUrl**(`url`): `void`

Consent guard (RFC-013 §11): HTTPS is required for remote hosts; plain `http`
is permitted only for loopback. Never ships a build-time localhost bypass.

## Parameters

### url

`string`

## Returns

`void`
