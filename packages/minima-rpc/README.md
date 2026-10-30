# @totemsdk/minima-rpc

**Direct RPC to a self-hosted MinimaRpc node — works in every JS runtime.**

Fetch-based (no Node-specific APIs). Use it in the browser, Node.js, Pear/Bare, or any environment with a global `fetch`. No dependencies.

## Install

```bash
npm install @totemsdk/minima-rpc
```

## What's inside

`createMinimaRpcClient(config)` returns a `MinimaRpcClient` object with full coverage of the Totem/Minima RPC command set:

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

`runCommand` knows the full 132-command node surface: known commands validate
required/unknown parameters and enums, coerce booleans/numbers/JSON values, and
emit the node's parameter order. Unknown commands retain an explicit passthrough
path.

Errors are typed as `MinimaRpcError`.

## Usage

### Create a client and query balance

```typescript
import { createMinimaRpcClient } from '@totemsdk/minima-rpc';

const rpc = createMinimaRpcClient({ nodeUrl: 'http://localhost:9005' });

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
await rpc.txnBasics(txId);
await rpc.txnInput(txId, { coinid: '0xABC...' });
await rpc.txnOutput(txId, { address: 'MxDEF...', amount: '1.5', tokenid: '0x00' });
await rpc.txnSign(txId, { privateKey: privateKeyHex });
const check = await rpc.txnCheck(txId);
const result = await rpc.txnPost({ id: txId, mine: true });
console.log('Posted:', result.txpowid);
```

### Manual transaction discipline

Prepare a transaction **once**:

`txnCreate → txnBasics → txnInput/txnOutput → txnSign → txnCheck → txnPost { id, mine: true }`

Do not pass `auto:true` after manually adding inputs: the node appends coin
proofs for `auto:true`, and a second `txnpost auto:true` invokes that helper
again. `txncheck` also does not prove that the subsequent `txnpost` will be
accepted; verify the returned `txpowid` and confirmation.

For a floating token input, convert the human amount to the token's raw unit
**once** at the builder boundary:

```typescript
import { toRawTokenAmount } from '@totemsdk/minima-rpc';
await rpc.txnInput(txId, {
  coinid: '0xABC...',
  tokenid: '0xTOKEN',
  amount: toRawTokenAmount('1.5', 8),
});
```

### Error handling

```typescript
import { createMinimaRpcClient, MinimaRpcError } from '@totemsdk/minima-rpc';

const rpc = createMinimaRpcClient({ nodeUrl: 'http://localhost:9005' });

try {
  await rpc.balance();
} catch (err) {
  if (err instanceof MinimaRpcError) {
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

- [`@totemsdk/chain-provider`](https://www.npmjs.com/package/@totemsdk/chain-provider) — `MinimaRpcProvider` wraps this client
- [`@totemsdk/node`](https://www.npmjs.com/package/@totemsdk/node) — higher-level Node.js wallet
- [`@totemsdk/lookup-node`](https://www.npmjs.com/package/@totemsdk/lookup-node) — uses this to relay to the Minima network


## Testing

Tests live outside the published package in `tests/unit/minima-rpc/`. Package `test:*` scripts are repository delegates.
