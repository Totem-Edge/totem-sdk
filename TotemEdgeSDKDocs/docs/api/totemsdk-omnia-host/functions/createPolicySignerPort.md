[**@totemsdk/omnia-host**](../index.md)

***

[@totemsdk/omnia-host](../index.md) / createPolicySignerPort

# Function: createPolicySignerPort()

> **createPolicySignerPort**(`base`, `policy?`): `SignerPort`

Wrap a signer port with policy checks. The underlying port may be a local
signer, KMS/HSM/MPC adapter, or hosted policy engine; this wrapper only
enforces the deployment policy and disclosure requirements.

## Parameters

### base

`SignerPort`

### policy?

[`SignerPolicy`](../interfaces/SignerPolicy.md) = `{}`

## Returns

`SignerPort`
