[**@totemsdk/omnia-router**](../index.md)

***

[@totemsdk/omnia-router](../index.md) / RouteBinding

# Interface: RouteBinding

What the route is supposed to do, expressed independently of the route object
(OMN-080). Without this a structurally valid route that pays nobody still
"passes" validation.

## Properties

### amount?

> `optional` **amount?**: `bigint`

Amount the recipient must receive.

***

### payer?

> `optional` **payer?**: `string`

Party the payment starts from.

***

### recipient?

> `optional` **recipient?**: `string`

Party the payment must reach.

***

### tokenId?

> `optional` **tokenId?**: `string`

Asset the recipient must receive.
