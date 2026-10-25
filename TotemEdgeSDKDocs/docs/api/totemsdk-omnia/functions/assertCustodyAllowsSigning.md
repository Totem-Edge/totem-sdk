[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / assertCustodyAllowsSigning

# Function: assertCustodyAllowsSigning()

> **assertCustodyAllowsSigning**(`request`, `options?`): `void`

The signer-side custody gate (RFC-061 D1).

- self: allowed, no hosted disclosure.
- trust-minimised: valid acknowledgement for the exact terms.
- hosted: valid acknowledgement + explicit positive policy decision.

## Parameters

### request

[`SignRequest`](../interfaces/SignRequest.md)

### options?

[`CustodySigningOptions`](../interfaces/CustodySigningOptions.md) = `{}`

## Returns

`void`
