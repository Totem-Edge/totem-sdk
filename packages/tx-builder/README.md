# @totemsdk/tx-builder

**Construct Minima transactions in pure TypeScript.**

Provides coin selection, multi-signature transaction management, and the `EnhancedBuildParams` type used across the SDK. Depends only on `@noble/hashes`.

## Install

```bash
npm install @totemsdk/tx-builder @noble/hashes
```

## What's inside

### Coin selection

| Export | What it does |
|--------|-------------|
| `CoinSelectionService` | Service class for selecting UTXOs to cover a payment |
| `CoinSelectionResult` | Result type: `selectedCoins`, `totalSelected`, `change`, `insufficientFunds`, `fromAddresses` |
| `CoinSelectionOptions` | Options: `mode` (`'global'` \| `'focused'`), `targetAmount`, `tokenId`, `focusedAddress` |
| `CoinSelectionError` | Typed error with `code`: `'INSUFFICIENT_FUNDS'`, `'FETCH_FAILED'`, etc. |
| `SpendableCoin` | A coin that is eligible for selection |

### Multi-signature

| Export | What it does |
|--------|-------------|
| `MultisigConfig` | Configuration for `'2of2'` or `'mofn'` multi-sig (`threshold`, `publicKeys`, `ownPublicKey`) |
| `PendingMultisigTransaction` | A multi-sig transaction awaiting co-signatures |

### Local transaction + witness assembly

| Export | What it does |
|--------|-------------|
| `buildTransaction(params)` | Build a `MinimaTransaction` locally from `EnhancedBuildParams` |
| `serializeWitness(wots, coinProofs, descriptors)` | Full witness: signatures + coin proofs + script proofs |
| `serializeForTxnImport(txId, tx, witness)` | `MiniString(id) + Transaction + Witness` for `txnimport` |
| `buildScriptProof(script)` | Node-equivalent single-script `ScriptProof` |
| `scriptAddress(script)` | Node-equivalent script address (hex data) |
| `transactionSigningDigestHex(params)` | Digest a local signer must sign |

### HTLC helpers

| Export | What it does |
|--------|-------------|
| `buildHtlcFundingOutput(parties, amount, tokenId?)` | HTLC script/address + funding output |
| `buildHtlcClaim(params)` | Claim params with preimage as transaction state port 1 (`hex`) |
| `buildHtlcRefund(params)` | Timout refund params (no preimage state) |

### Optional node-side assembly

| Export | What it does |
|--------|-------------|
| `assembleViaNode(client, params)` | `txncreate → txninput(scriptmmr) → txnoutput → txnstate → txnbasics → txnpost → txndelete` |

`assembleViaNode` is for a local/paired node. The edge path is
`buildTransaction` + `serializeWitness` + local signing.

### Coin providers, fee/change, signing, submit (P1)

| Export | What it does |
|--------|-------------|
| `fromChainProvider(provider)` | Adapt `@totemsdk/chain-provider` to a `CoinProvider` |
| `fromMinimaRpc(client)` | Adapt a raw `MinimaRpcClient` (Hawk/local node) |
| `buildFundedPayment(params)` | Select coins, add a fee coin, build outputs + change |
| `signAndSerialize(params, signer, txId)` | Build → sign digest → witness → TxnRow |
| `reserveSigningIndices` / `commitSigningReservation` / `releaseSigningReservation` | WOTS lease lifecycle |
| `signWithLease(...)` | Reserve → local sign → return reservation |
| `dryRunViaNode(client, txnId)` | `txncheck` before signing/posting |
| `submitSignedTxn(client, {txnId, txnRowHex})` | `txnimport` → `txnpost` |
| `submitTxnId(client, txnId)` | `txnpost` an imported txn |
| `submitTxPoW(provider, txpowHex)` | Chain-provider broadcast |
| `mineTransaction({transaction, witness})` | Serialize + mine a TxPoW (`@totemsdk/txpow`) |
| `mineAndSubmitTxPoW(params, provider)` | Mine + broadcast |
| `createRawNodeCommandClient(config)` | Text/plain node transport that preserves script spaces |

`buildFundedPayment` returns `EnhancedBuildParams` plus the selected coins,
change, and fee coin. Token payments select a separate native fee coin and
return it as change.

### Transaction types

| Export | What it does |
|--------|-------------|
| `EnhancedBuildParams` | Full transaction build parameters (`inputs`, `outputs`, `transactionState`, `linkHash`) |
| `EnhancedCoinInput` | Input coin with `coinId`, `address`, `amount`, `scriptDescriptor`, `coinProofHex` |
| `EnhancedCoinOutput` | Output with `address`, `amount`, `tokenId`, `storeState`, `state` |

## Usage

### Select coins for a payment

```typescript
import { CoinSelectionService, CoinSelectionError } from '@totemsdk/tx-builder';

const service = new CoinSelectionService(storage, coinFetcher);

try {
  const result = await service.selectCoinsForSend('MxABC...', {
    mode: 'global',
    targetAmount: '10',
    tokenId: '0x00',
  });

  console.log('Selected coins:', result.selectedCoins.length);
  console.log('Change:', result.change);
} catch (err) {
  if (err instanceof CoinSelectionError && err.code === 'INSUFFICIENT_FUNDS') {
    console.error('Not enough funds');
  }
}
```

### Build transaction parameters

```typescript
import type { EnhancedBuildParams } from '@totemsdk/tx-builder';

// Assemble params to pass to sendComplex() in @totemsdk/connect
const buildParams: EnhancedBuildParams = {
  inputs: [
    {
      coinId: '0xABC...',
      address: 'MxABC...',
      amount: '15',
      tokenId: '0x00',
      scriptDescriptor: { type: 'signedby', publicKey: '0x...' },
      coinProofHex: '...',
    },
  ],
  outputs: [
    { address: 'MxDEF...', amount: '10', tokenId: '0x00' },
    { address: 'MxABC...', amount: '5',  tokenId: '0x00' }, // change
  ],
};
```

### Multi-signature configuration

```typescript
import type { MultisigConfig } from '@totemsdk/tx-builder';

const config: MultisigConfig = {
  type: 'mofn',
  threshold: 2,
  publicKeys: ['0xAAA...', '0xBBB...', '0xCCC...'],
  ownPublicKey: '0xAAA...',
};
```

## Upstream Java source

This package is a TypeScript port of Minima's transaction construction and coin selection logic. Canonical upstream references:

- [`system/commands/send/send.java`](https://github.com/spartacusrex-minima/minima-core/blob/main/src/org/minima/system/commands/send/send.java) — coin selection and send logic
- [`system/commands/txn/txnutils.java`](https://github.com/spartacusrex-minima/minima-core/blob/main/src/org/minima/system/commands/txn/txnutils.java) — transaction construction utilities
- [`system/commands/txn/`](https://github.com/spartacusrex-minima/minima-core/blob/main/src/org/minima/system/commands/txn/) — full txn command tree (txncreate, txninput, txnoutput, txnsign, txnpost, txnmine, etc.)

## See also

- [`@totemsdk/txpow`](https://www.npmjs.com/package/@totemsdk/txpow) — mine and broadcast a completed transaction
- [`@totemsdk/connect`](https://www.npmjs.com/package/@totemsdk/connect) — `sendComplex(origin, buildParams)` uses `EnhancedBuildParams`
- [`@totemsdk/core`](https://www.npmjs.com/package/@totemsdk/core) — WOTS signing primitives
- [`@totemsdk/wots-lease`](https://www.npmjs.com/package/@totemsdk/wots-lease) — key safety for signing slots


## Testing

Tests live outside the published package in `tests/unit/tx-builder/`. Package `test:*` scripts are repository delegates.
