[**@totemsdk/chain-provider**](../index.md)

***

[@totemsdk/chain-provider](../index.md) / ResolveChainProviderOptions

# Interface: ResolveChainProviderOptions

## Properties

### createMinimaProvider?

> `readonly` `optional` **createMinimaProvider?**: (`config`) => [`ChainStateProvider`](ChainStateProvider.md)

Override node provider construction (tests).

#### Parameters

##### config

[`ChainProviderConfig`](ChainProviderConfig.md)

#### Returns

[`ChainStateProvider`](ChainStateProvider.md)

***

### hosted

> `readonly` **hosted**: [`HostedRelayConfig`](HostedRelayConfig.md)

Hosted relay credentials (Axia by default).

***

### hostedProvider?

> `readonly` `optional` **hostedProvider?**: [`ChainStateProvider`](ChainStateProvider.md)

Override hosted provider construction (tests / custom relay).

***

### onFallback?

> `readonly` `optional` **onFallback?**: (`method`, `error`) => `void`

#### Parameters

##### method

`string`

##### error

`unknown`

#### Returns

`void`

***

### validateUrl?

> `readonly` `optional` **validateUrl?**: (`url`) => `void`

URL consent check. Defaults to [assertConsentedNodeUrl](../functions/assertConsentedNodeUrl.md).

#### Parameters

##### url

`string`

#### Returns

`void`
