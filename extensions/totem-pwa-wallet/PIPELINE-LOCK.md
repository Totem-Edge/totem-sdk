# Transaction pipeline lock

The build → sign → finalize path is pinned. Treat these files as protocol code,
not UI code.

## Files under lock

| File | Why |
|---|---|
| `src/core/buildTxnRow.ts` | Byte-exact `TxnRow` serialization; must match `TxnRow`/`CoinProof`/`TreeSignature` in the Java node. |
| `src/core/stateSerialization.ts` | `StateVariable` port/type/length encoding; must match Java `StateVariable.writeDataStream()`. |
| `src/core/api.ts` | Lease, coin proof, watermark and `finalizeLease` request shapes. |
| `src/pages/Send.tsx` | Fixed step order and the exact `signedHex` handed to `/finalize`. |
| `../totem-extension/src/core/transaction/service.ts` | Extension finalize request (same wire contract). |
| `../totem-extension/src/core/transaction/MinimaTransactionBuilder.ts` | Extension `TxnRow` serialization. |
| `../totem-extension/src/core/transaction/useSendTransaction.ts` | Extension send step order. |
| `../totem-extension/src/core/transaction/hawkTransactionService.ts` | Hawk-path signed-hex handling. |
| `../../../axia-platform/packages/axia-api/src/wots/finalize.ts` | Server-side hex validation, `txnimport` → `txncheck` → `txnpost`. |

## Invariants other agents must not change casually

1. **One `0x` prefix.** `signedHex` is exactly `0x` + lowercase hex. Repeated
   prefixes (`0x0x…`), whitespace, odd length and `0X` are client bugs; the API
   normalizes defensively, but a wallet must never rely on that.
2. **Tip-anchored proofs.** A spend proof is exported with `coinexport …
   spend:true` (full `getProof` at the current tip), matching
   `coinexport.cpp`. The default export stays tip − 256 for non-spend callers.
3. **Isolated validation.** `txncheck` / `txnpost` run with `mempool:false`, so
   unrelated mempool transactions cannot make a valid TxPoW fail.
4. **Step order.** watermark sync → `fetchCoins` → `selectCoins` → `prepareLease`
   → `fetchCoinProofs` → build/sign → `finalizeLease`. Do not add client-side
   re-mine or retry loops around `finalize`.
5. **No legacy script workarounds.** Pre-0x `RETURN SIGNEDBY(4999…)` addresses
   are unspendable network-wide. The wallet refuses them and asks for a new
   account; it must not try to patch scripts client-side.

## Changing a locked file

1. Confirm the change against the Java reference (`hawk-node`,
   `BaseConverter.decode16`, `TxnRow` streamables) — not just against a passing
   client test.
2. Update the pin in the same commit:
   ```bash
   npm run lock:update
   ```
3. `npm test` (or `npm run lock:verify`) must pass. A bare `lock:update`
   without the protocol review defeats the lock.
