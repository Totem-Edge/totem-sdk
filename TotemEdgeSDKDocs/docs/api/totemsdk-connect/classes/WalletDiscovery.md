[**@totemsdk/connect**](../index.md)

***

[@totemsdk/connect](../index.md) / WalletDiscovery

# Class: WalletDiscovery

WalletDiscovery — listens for wallet announcements via the 'totem:announce'
CustomEvent and maintains a live list of available wallets.

Usage:
  const discovery = new WalletDiscovery();

  // Subscribe to wallet list changes
  const unsubscribe = discovery.onChange((wallets) => {
    if (wallets.length === 1) {
      setActiveProvider(wallets[0].provider);
    }
  });

  // Snapshot of currently-known wallets
  const wallets = discovery.getWallets();

  // Teardown (removes the 'totem:announce' listener)
  discovery.destroy();

## Constructors

### Constructor

> **new WalletDiscovery**(): `WalletDiscovery`

#### Returns

`WalletDiscovery`

## Methods

### addWallet()

> **addWallet**(`wallet`): `void`

Register a wallet manually. This is the non-browser / headless fallback:
callers (CLI, Node, Bare, SSR) that have no `totem:announce` event source
can inject a provider directly instead of relying on `window` CustomEvents.

#### Parameters

##### wallet

[`DiscoveredWallet`](../interfaces/DiscoveredWallet.md)

#### Returns

`void`

***

### destroy()

> **destroy**(): `void`

#### Returns

`void`

***

### getWallets()

> **getWallets**(): readonly [`DiscoveredWallet`](../interfaces/DiscoveredWallet.md)[]

#### Returns

readonly [`DiscoveredWallet`](../interfaces/DiscoveredWallet.md)[]

***

### onChange()

> **onChange**(`callback`): () => `void`

#### Parameters

##### callback

(`wallets`) => `void`

#### Returns

() => `void`

***

### removeWallet()

> **removeWallet**(`id`): `void`

Remove a manually-registered (or announced) wallet by id.

#### Parameters

##### id

`string`

#### Returns

`void`
