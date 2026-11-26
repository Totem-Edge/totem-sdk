[**@totemsdk/omnia-router**](../index.md)

***

[@totemsdk/omnia-router](../index.md) / VerifyRouterFeeProofOptions

# Interface: VerifyRouterFeeProofOptions

## Properties

### verifySignature?

> `optional` **verifySignature?**: (`state`, `party`) => `boolean`

Optional signature check over the successor state. The router is runtime
neutral, so bilateral authorization is verified by the caller that holds
the channel keys.

#### Parameters

##### state

[`RouterSignedState`](RouterSignedState.md)

##### party

###### partyId

`string`

###### publicKeyDigest

`string`

#### Returns

`boolean`
