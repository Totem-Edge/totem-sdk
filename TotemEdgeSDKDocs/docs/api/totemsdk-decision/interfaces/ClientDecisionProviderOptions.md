[**@totemsdk/decision**](../index.md)

***

[@totemsdk/decision](../index.md) / ClientDecisionProviderOptions

# Interface: ClientDecisionProviderOptions

## Properties

### capabilities?

> `readonly` `optional` **capabilities?**: readonly [`DecisionCapability`](../type-aliases/DecisionCapability.md)[]

***

### choiceComplete?

> `readonly` `optional` **choiceComplete?**: `boolean`

Set when the client always returns a full distribution over every choice
label (Laya/Jev choice heads). The runtime then enforces coverage + sum ≈ 1.

***

### choiceSelection?

> `readonly` `optional` **choiceSelection?**: `"provider"` \| `"argmax"`

Client-contract selection rule. Laya/Jev select the argmax.

***

### client

> `readonly` **client**: [`DecisionClientLike`](DecisionClientLike.md)

***

### displayName?

> `readonly` `optional` **displayName?**: `string`

***

### distributionTolerance?

> `readonly` `optional` **distributionTolerance?**: `number`

Client-contract sum tolerance for complete distributions. Laya rounds to
4 dp and Jev accepts < 0.02, so typed clients declare ~0.02; deterministic
providers keep the 1e-6 default.

***

### id

> `readonly` **id**: `string`

***

### info?

> `readonly` `optional` **info?**: [`DecisionProviderInfo`](DecisionProviderInfo.md)

***

### isReady?

> `readonly` `optional` **isReady?**: `boolean`

***

### model?

> `readonly` `optional` **model?**: `string`

***

### probabilityField?

> `readonly` `optional` **probabilityField?**: `string`

Provider client's probability value field (e.g. `'noul'`). Default `'probability'`.

***

### probabilityType?

> `readonly` `optional` **probabilityType?**: `string`

Provider client's probability question type (e.g. `'noul'`). Default `'probability'`.

***

### version?

> `readonly` `optional` **version?**: `string`
