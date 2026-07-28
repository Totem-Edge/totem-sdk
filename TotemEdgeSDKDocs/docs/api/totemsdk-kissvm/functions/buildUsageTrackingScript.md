[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / buildUsageTrackingScript

# Function: buildUsageTrackingScript()

> **buildUsageTrackingScript**(`config`): `string`

Build a usage tracking script that enforces:
  1. If past window end, reset count/amount to current values
  2. Otherwise, check count <= maxCount and amount <= maxAmount
  3. Nonce-based replay protection

Port layout:
  0 — count
  1 — amount
  2 — window end block
  3 — nonce

## Parameters

### config

[`UsageTrackingConfig`](../interfaces/UsageTrackingConfig.md)

## Returns

`string`
