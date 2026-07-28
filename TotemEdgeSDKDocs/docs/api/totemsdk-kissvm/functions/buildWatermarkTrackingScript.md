[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / buildWatermarkTrackingScript

# Function: buildWatermarkTrackingScript()

> **buildWatermarkTrackingScript**(`config`): `string`

Build a watermark tracking script that enforces:
  1. Watermark cursor increases monotonically (cur > prev)
  2. TTL: elapsed blocks since previous watermark >= minInterval
  3. State range unchanged (SAMESTATE on watermarkPort range)

Port layout:
  0 — watermark cursor value
  1 — last watermark block
  2 — min interval (blocks between watermarks)

## Parameters

### config

[`LeaseCertificateConfig`](../interfaces/LeaseCertificateConfig.md)

## Returns

`string`
