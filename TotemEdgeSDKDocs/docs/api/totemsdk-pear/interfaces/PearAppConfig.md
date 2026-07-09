[**@totemsdk/pear**](../index.md)

***

[@totemsdk/pear](../index.md) / PearAppConfig

# Interface: PearAppConfig

## Properties

### onUpdate?

> `optional` **onUpdate?**: () => `void` \| `Promise`\<`void`\>

Called when Pear signals the app should update (swap to a new version).
This callback is registered on every `createPearApp` call that supplies it,
allowing the handler to be refreshed across hot-reloads.
If absent, the default Pear behaviour applies.

#### Returns

`void` \| `Promise`\<`void`\>
