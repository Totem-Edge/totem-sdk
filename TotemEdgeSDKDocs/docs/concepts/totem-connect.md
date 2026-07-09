---
id: totem-connect
title: Totem Connect (dApp Provider)
sidebar_label: Totem Connect
description: How dApps connect to the Totem wallet extension using @totemsdk/connect.
---

# Totem Connect

`@totemsdk/connect` is the client-side bridge between a web dApp and the Totem wallet browser extension. It follows the TOTEM_CONNECT v4.1 protocol.

## Quick start

```typescript
import {
  connect,
  verify,
  sendTransaction,
  revokeTxPermission,
  isTotemInstalled,
  onEvent,
} from '@totemsdk/connect';

// 1. Check wallet is installed
if (!isTotemInstalled()) {
  alert('Install the Totem extension from totem.minima.global');
}

// 2. Connect and get the active address
const { address } = await connect(location.origin);

// 3. Verify ownership (SIWE-style)
const proof = await verify(location.origin, { statement: 'Sign in to MyApp' });

// 4. Send a transaction
const result = await sendTransaction(location.origin, {
  version: 1,
  outputs: [{ address: recipientAddr, amount: '10', tokenId: '0x00' }],
});

// 5. Listen for account changes
const unsub = onEvent('accountsChanged', (accounts) => {
  console.log('Active account changed:', accounts[0]);
});

// 6. Clean up on logout
unsub();
await revokeTxPermission(location.origin);
```

## Events

| Event | Payload | When |
|-------|---------|------|
| `accountsChanged` | `string[]` | User switches active address |
| `connected` | `{ address: string }` | Connection established |
| `disconnected` | `void` | User revokes permission |

## See also

- [`@totemsdk/connect` API reference](/api/totemsdk-connect)
- [TESSA Pay guide](/guides/tessa-pay) — full merchant integration
- [Statechain Pass guide](/guides/statechain-pass) — browser-connected access passes
