[**@totemsdk/claim**](../index.md)

***

[@totemsdk/claim](../index.md) / ClaimEnvelope

# Interface: ClaimEnvelope

## Properties

### metadata?

> `optional` **metadata?**: `Record`\<`string`, `unknown`\>

Opaque, untrusted metadata (issuer branding, campaign id, transport hints).
Never use it for authorization or settlement decisions.

***

### payload

> **payload**: [`ClaimPayload`](../type-aliases/ClaimPayload.md)

***

### policy

> **policy**: [`ClaimPolicy`](../type-aliases/ClaimPolicy.md)

***

### version

> **version**: `1`
