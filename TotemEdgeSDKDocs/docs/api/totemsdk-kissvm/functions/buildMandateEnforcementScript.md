[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / buildMandateEnforcementScript

# Function: buildMandateEnforcementScript()

> **buildMandateEnforcementScript**(`config`): `string`

Build a mandate enforcement script that checks:
  1. Grantor signed the transaction
  2. Mandate scope matches the committed scope
  3. Mandate is not expired (@BLOCK <= expiresAtBlock)
  4. Mandate is not revoked (current epoch <= revocationEpoch)
  5. Nonce-based replay protection

Port layout:
  0 — scope match hash
  1 — revocation epoch
  2 — expiresAt block
  3 — nonce

## Parameters

### config

[`MandateEnforcementConfig`](../interfaces/MandateEnforcementConfig.md)

## Returns

`string`
