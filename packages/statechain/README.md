# @totemsdk/statechain

**Off-chain UTXO ownership transfer using the Mercury protocol.**

A statechain lets you transfer ownership of a UTXO to a new owner without an on-chain transaction. A co-signing State Entity (SE) issues a blind signature so the transfer is provably authorized — but the SE never learns the UTXO value or the identities of sender or receiver.

## Install

```bash
npm install @totemsdk/statechain
```

## What's inside

| Export | What it does |
|--------|-------------|
| `createStateChain(coin, se)` | Lock a UTXO into a statechain with a co-signing State Entity |
| `transferOwnership(chain, newOwner, signer)` | Transfer control to a new owner; the SE issues a blind signature |
| `verifyStateChain(chain)` | Verify the full chain of custody from creation to current owner |
| `claimOwnership(chain, signer)` | Cooperatively claim the UTXO on-chain with the SE's signature |
| `reclaimAbandoned(chain)` | Unilateral claim after `RECLAIM_TIMELOCK` if the SE goes offline |
| `buildStatechainScript(pubKey)` | Construct the KISSVM locking script for the UTXO |
| `scriptAddress(script)` | Derive the Minima address for a statechain script |
| `RECLAIM_TIMELOCK` | Configurable safety window (default: 2016 blocks ≈ 2 weeks) |

### Privacy property

The State Entity uses **blind signatures** — it signs what the new owner presents without seeing the content. The SE knows a transfer happened but learns nothing about the UTXO value or the parties involved.

## Usage

### Lock a UTXO into a statechain

```typescript
import { createStateChain } from '@totemsdk/statechain';

const chain = await createStateChain({
  coin,                          // the UTXO to lock
  stateEntityUrl: 'https://se.axia.to',
  ownerPublicKey: myPublicKey,
  signer,
  provider,
});

console.log('Statechain ID:', chain.id);
console.log('Lock script:', chain.script);
```

### Transfer ownership off-chain

```typescript
import { transferOwnership } from '@totemsdk/statechain';

const updatedChain = await transferOwnership(chain, {
  newOwnerPublicKey: recipientPublicKey,
  signer,
});

// Send updatedChain to the recipient (off-chain, e.g. QR code, message)
```

### Verify the chain of custody

```typescript
import { verifyStateChain } from '@totemsdk/statechain';

const valid = await verifyStateChain(chain);
console.log('Chain of custody valid:', valid);
```

### Claim the UTXO on-chain

```typescript
import { claimOwnership } from '@totemsdk/statechain';

const claimHex = await claimOwnership(chain, { signer });
await provider.broadcastTxPoW(claimHex);
```

### Reclaim if State Entity goes offline

```typescript
import { reclaimAbandoned, RECLAIM_TIMELOCK } from '@totemsdk/statechain';

// After RECLAIM_TIMELOCK blocks have passed without an SE response
const reclaimHex = await reclaimAbandoned(chain, { signer });
await provider.broadcastTxPoW(reclaimHex);
```

## See also

- [`@totemsdk/core`](https://www.npmjs.com/package/@totemsdk/core) — WOTS signing used for statechain state transitions
- [`@totemsdk/kissvm`](https://www.npmjs.com/package/@totemsdk/kissvm) — evaluates the statechain locking script
- [`@totemsdk/wots-lease`](https://www.npmjs.com/package/@totemsdk/wots-lease) — protects signing slots during transfers
- [`@totemsdk/connect`](https://www.npmjs.com/package/@totemsdk/connect) — `totemStatechainCreate` / `totemStatechainTransfer` extension methods
