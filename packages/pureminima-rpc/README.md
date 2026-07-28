# @totemsdk/pureminima-rpc

**Direct RPC to a self-hosted PureMinima node — works in every JS runtime.**

Fetch-based (no Node-specific APIs). Use it in the browser, Node.js, Pear/Bare, or any environment with a global `fetch`. No dependencies.

## Install

```bash
npm install @totemsdk/pureminima-rpc
```

## What's inside

`createPureMinimaClient(config)` returns a `PureMinimaClient` object with full coverage of the PureMinima RPC command set:

| Method | What it does |
|--------|-------------|
| `status()` | Node status and block height |
| `balance(query?)` | Balance for address(es), with `BalanceQuery` filters |
| `coins(query?)` | List coins/UTXOs with `CoinsQuery` filters |
| `tokens(tokenId?, action?)` | Token info lookup |
| `getAddress()` | Current node address info |
| `megammr()` | MegaMMR info |
| `history(params?)` | Transaction history |
| `txnCreate(id)` / `txnInput` / `txnOutput` / `txnState` / `txnScript` / `txnSign` / `txnPost` / `txnMine` | Full transaction builder |
| `runCommand(cmd, params?)` | Raw command escape hatch |

Errors are typed as `PureMinimaRpcError`.

## Usage

### Create a client and query balance

```typescript
import { createPureMinimaClient } from '@totemsdk/pureminima-rpc';

const rpc = createPureMinimaClient({ nodeUrl: 'http://localhost:9005' });

const balances = await rpc.balance({ address: 'Mx...' });
console.log('Confirmed:', balances[0]?.confirmed);
```

### Get node status

```typescript
const status = await rpc.status();
console.log('Block height:', status.block);
```

### Build and post a raw transaction

```typescript
const txId = 'my-tx-001';
await rpc.txnCreate(txId);
await rpc.txnInput(txId, { coinId: '0xABC...', scriptmmr: true });
await rpc.txnOutput(txId, { address: 'MxDEF...', amount: '1.5', tokenid: '0x00' });
await rpc.txnSign(txId, { privateKey: privateKeyHex });
const result = await rpc.txnPost(txId, { mine: true });
console.log('Posted:', result.txpowid);
```

### Error handling

```typescript
import { createPureMinimaClient, PureMinimaRpcError } from '@totemsdk/pureminima-rpc';

const rpc = createPureMinimaClient({ nodeUrl: 'http://localhost:9005' });

try {
  await rpc.balance();
} catch (err) {
  if (err instanceof PureMinimaRpcError) {
    console.error('Node error:', err.message);
  }
}
```

## Upstream Java source

This package is a TypeScript port of the Minima Java RPC layer. Canonical upstream references:

- [`system/network/rpc/CMDHandler.java`](https://github.com/spartacusrex-minima/minima-core/blob/main/src/org/minima/system/network/rpc/CMDHandler.java) — HTTP RPC command dispatcher (wire format)
- [`system/network/rpc/HTTPServer.java`](https://github.com/spartacusrex-minima/minima-core/blob/main/src/org/minima/system/network/rpc/HTTPServer.java) — RPC server entry point
- [`system/commands/`](https://github.com/spartacusrex-minima/minima-core/blob/main/src/org/minima/system/commands/) — full command tree (balance, send, getaddress, sign, txn\*, coinexport, etc.)

## See also

- [`@totemsdk/chain-provider`](https://www.npmjs.com/package/@totemsdk/chain-provider) — `PureMinimaRpcProvider` wraps this client
- [`@totemsdk/node`](https://www.npmjs.com/package/@totemsdk/node) — higher-level Node.js wallet
- [`@totemsdk/lookup-node`](https://www.npmjs.com/package/@totemsdk/lookup-node) — uses this to relay to the Minima network
