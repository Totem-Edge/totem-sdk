[**@totemsdk/industrial-action**](../index.md)

***

[@totemsdk/industrial-action](../index.md) / computeAuthorityBindingHash

# Function: computeAuthorityBindingHash()

> **computeAuthorityBindingHash**(`commitmentHash`, `mandateProofId?`, `decisionId?`): `string`

RFC-010 §6.4 — authority binding digest.

Ties a proposal commitment to the exact mandate proof and authorization
decision that authorized it. The decision id is generally only known *after*
authorization (the edge runtime prepares before it authorizes), so this is
computed at the receipt/record layer rather than at `prepare` time.

## Parameters

### commitmentHash

`string`

### mandateProofId?

`string`

### decisionId?

`string`

## Returns

`string`
