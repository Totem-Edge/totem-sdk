[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / buildLeaseCertificateScript

# Function: buildLeaseCertificateScript()

> **buildLeaseCertificateScript**(`config`): `string`

Build a lease certificate verification script that checks:
  1. Authority signed the certificate
  2. Certificate fields (treeId, deviceId, branchId, purpose, payload) match committed state
  3. Current block < expiresAt (not expired)
  4. State is unchanged (SAMESTATE)

## Parameters

### config

[`LeaseCertificateConfig`](../interfaces/LeaseCertificateConfig.md)

## Returns

`string`
