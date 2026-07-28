# @totemsdk/omnia-splice

**Resize channels without closing them.**

Channel splicing lets you add or remove funds from an active Omnia channel without the disruptive close → reopen cycle. A splice produces a new on-chain UTXO with the adjusted balance while keeping the channel's off-chain state intact.

## Install

```bash
npm install @totemsdk/omnia-splice
```

## What's inside

| Export | What it does |
|--------|-------------|
| `proposeSpliceIn(channel, amount)` | Propose adding funds to a channel |
| `proposeSpliceOut(channel, amount)` | Propose withdrawing funds from a channel |
| `acceptSplice(proposal, signer)` | Co-sign a splice proposal |
| `quiesceChannel(channel)` | Drain all in-flight HTLCs before splicing (required safety step) |
| `buildSpliceTx(proposal)` | Construct the on-chain splice transaction |
| `finalizeSplice(proposal, signatures)` | Finalize and return the broadcast-ready hex |

### Error taxonomy

| Error | Cause |
|-------|-------|
| `SpliceBalanceConservationError` | Output amounts don't sum correctly — prevents funds from disappearing |
| `PendingHTLCError` | Splice attempted while HTLCs are still in-flight (quiesce first) |
| `SpliceChannelStatusError` | Channel is not in a state that permits splicing |
| `SpliceSignatureMismatchError` | Co-signature does not match the proposal |

## Usage

### Splice in (add funds)

```typescript
import { quiesceChannel, proposeSpliceIn, acceptSplice, buildSpliceTx, finalizeSplice } from '@totemsdk/omnia-splice';

// 1. Drain HTLCs (both sides must stop sending)
await quiesceChannel(channel);

// 2. Local side proposes adding 50 MIN
const proposal = await proposeSpliceIn(channel, { amount: '50', tokenid: '0x00' });

// 3. Remote side accepts
const remoteSig = await remoteAccept(proposal);          // out-of-band exchange

// 4. Build and finalize the on-chain transaction
const spliceTx  = buildSpliceTx(proposal);
const finalHex  = finalizeSplice(proposal, [localSig, remoteSig]);

// 5. Broadcast
await provider.broadcastTxPoW(finalHex);
```

### Splice out (withdraw funds)

```typescript
import { proposeSpliceOut } from '@totemsdk/omnia-splice';

await quiesceChannel(channel);
const proposal = await proposeSpliceOut(channel, {
  amount: '20',
  withdrawTo: 'MxDEF...',  // on-chain destination for the withdrawn funds
});
```

### Error handling

```typescript
import { PendingHTLCError, SpliceBalanceConservationError } from '@totemsdk/omnia-splice';

try {
  await proposeSpliceIn(channel, { amount: '50', tokenid: '0x00' });
} catch (err) {
  if (err instanceof PendingHTLCError) {
    console.error('Must quiesce channel first — there are in-flight HTLCs');
  }
  if (err instanceof SpliceBalanceConservationError) {
    console.error('Balance mismatch in splice proposal');
  }
}
```

## See also

- [`@totemsdk/omnia`](https://www.npmjs.com/package/@totemsdk/omnia) — the channel state machine being spliced
- [`@totemsdk/tx-builder`](https://www.npmjs.com/package/@totemsdk/tx-builder) — used internally by `buildSpliceTx`
- [`@totemsdk/wots-lease`](https://www.npmjs.com/package/@totemsdk/wots-lease) — signing slots managed during splice
