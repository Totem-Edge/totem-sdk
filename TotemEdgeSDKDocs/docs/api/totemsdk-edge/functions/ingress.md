[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / ingress

# Function: ingress()

> **ingress**(`raw`, `context`, `opts`): `Promise`\<[`IngressResult`](../interfaces/IngressResult.md)\>

Run the authenticated ingress pipeline. Returns the authenticated message
and sender, or throws a typed error.

The replay claim is ATOMIC: two identical messages arriving concurrently
cannot both observe "not present". Exactly one caller wins the claim.

## Parameters

### raw

`unknown`

### context

#### recipient

`string`

#### sender

`string`

### opts

[`IngressOptions`](../interfaces/IngressOptions.md)

## Returns

`Promise`\<[`IngressResult`](../interfaces/IngressResult.md)\>
