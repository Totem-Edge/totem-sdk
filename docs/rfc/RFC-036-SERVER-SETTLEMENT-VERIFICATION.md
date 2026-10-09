# RFC-036 — Server Settlement Verification & Package Identity

**Status:** Draft — design specification
**Created:** 2026-10-08
**Authors:** Totem SDK Contributors
**Depends on:** RFC-005 (SDK & wallet gap fixes), RFC-014 (wallet connect parity, receipts), RFC-015 (Axia API alignment)
**Touches:** `@totemsdk/server` (`sendTransaction`, `MinimaClient`, `MinimaProvider`, README, `@module` tag)

> Two independent issues are folded here because they touch one package and one
> consumer (Canary): `@totemsdk/server`'s `sendTransaction` returns on
> **submission**, not **settlement**; and the package's public identity is
> documented as `@totemsdk/node`, which is not its name. The first is a scope
> statement + an added verification capability; the second is a documentation
> correction.

---

## 1. Summary

`@totemsdk/server` provides a genuine server-side transaction pipeline:
`sendTransaction()` fetches coins and MMR proofs, builds and signs a TxPoW with a
per-address WOTS TreeKey, mines it in a `worker_threads` Worker, and submits it to
Axia. On success it returns:

```ts
export interface SendResult {
  txpowId: string;
  status: 'submitted';          // literal — always 'submitted'
  miningSource: MineResult['source'];
  elapsedMs: number;
}
```

Submission is not settlement. A successful `sendTransaction()` does **not**
establish that the transaction was included in a block, that balances changed, or
that the transaction is recoverable from the node. This RFC (a) states that scope
explicitly in code and docs, and (b) specifies the confirmation/finality
verification that Canary (and any consumer) must perform, so it is a first-class,
tested capability rather than an improvisation.

It also corrects the package identity: the README, install line, all import
examples, and the `@module` JSDoc call the package `@totemsdk/node`; the actual
package is `@totemsdk/server` (`packages/server/package.json`).

## 2. Motivation

- **False confidence.** A consumer that logs `status: 'submitted'` and treats the
  send as complete can report a confirmed payment that never confirmed. The field
  name `status` invites exactly that misread.
- **Canary needs more.** An acceptance/soak test must verify inclusion, final
  balances, and recoverability. Today there is no in-package helper, so each
  consumer re-implements polling — inconsistently.
- **Package identity.** `npm install @totemsdk/node` fails; the published name is
  `@totemsdk/server`. This has already caused confusion (the two-observation
  review). Doc/namespace drift is a correctness issue for an SDK.

## 3. Current state (verified)

- `sendTransaction` (`packages/server/src/sendTransaction.ts:359`) returns
  `status: 'submitted'` at `:506`; there is no confirmation/polling call.
- `MinimaClient` (`packages/server/src/client.ts`) exposes `getBlockHeight()`
  (`status` RPC) and `getBalance(address, tokenId)`; `MinimaProvider.request`
  routes `minima_getBlockHeight`/`minima_getBalance`.
- The extension already does this on its side, but imperfectly:
  `pollTransactionConfirmation(txpowid)` (`extensions/totem-extension/src/background/index.ts:215`)
  polls **Axia's `txpow` RPC** (`/v1/{projectId}`), and on `data.result && !data.error`
  calls `transactionReceiptStore.markConfirmed(txpowid, txpowData.header?.block, 1)`.
  It does **not** assert `isblock` before marking confirmed — a reference worth
  improving, and a caution for this RFC's verifier. The server package has no
  equivalent at all.
- `ChainStateProvider` (`packages/chain-provider/src/types.ts:138`) exposes
  `getTip()`, `getCoin`, `getCoins`, `getProof`, token lookups, and `broadcastTxPoW`
  — enough to observe a tip/block (`getTip`) and reconstruct balances from coins
  on the shared interface. It has **no** `getBalance` convenience; balance is
  derived from `getCoins`.
- README drift: `packages/server/README.md:1,10,35,59,80` and
  `packages/server/src/index.ts:2` say `@totemsdk/node`.

## 4. Goals

1. Make the submission-only scope **unmistakable** in the type, the return value,
   and the README.
2. Add an in-package **await confirmation** capability so consumers (Canary) can
   reach a settled outcome without re-implementing polling.
3. Verify, against the node, that the txpowid is **included** and return the
   confirming block; optionally verify **balance delta** and **recoverability**.
4. Correct the package name/identity everywhere.
5. Keep the change additive; `sendTransaction()`'s existing callers keep working.

## 5. Non-goals

- Making `sendTransaction()` block until confirmation by default (that would break
  existing callers and server throughput). Settlement is an explicit, opt-in step.
- Re-implementing Axia's status/receipt endpoints here — RFC-015 P4 owns whether
  Axia is canonical; RFC-014 makes the wallet local. This RFC is the **SDK-side**
  verifier that works against either.
- Consensus/economic finality beyond Minima's mempool→block inclusion.

## 6. Design

### 6.1 Rename the status contract

Make the submission-only meaning explicit in the type, not just a literal:

```ts
export interface SendResult {
  txpowId: string;
  /** The TxPoW was accepted for broadcast. NOT confirmation. */
  status: 'submitted';
  miningSource: MineResult['source'];
  elapsedMs: number;
  /** Human-facing reminder; consumers should assert on this before claiming settlement. */
  settlement: 'unverified';
}
```

`settlement: 'unverified'` forces consumers to acknowledge the gap; a later
`awaitConfirmation` returns a distinct settled result.

### 6.2 `awaitConfirmation`

Add a verifier that polls the node (via `MinimaProvider`/`ChainStateProvider`)
until inclusion or timeout:

```ts
export interface ConfirmParams {
  txpowId: string;
  /** Provider to poll (MinimaProvider or any ChainStateProvider). */
  provider: MinimaProvider | ChainStateProvider;
  /** Poll interval ms (default 3000). */
  intervalMs?: number;
  /** Overall timeout ms (default 120000). */
  timeoutMs?: number;
  /** Optional: expected balance delta to assert on the recipient. */
  expect?: {
    toAddress: string;
    tokenId?: string;
    /** Minimum increase, decimal string. Exact-delta check is offered when set. */
    minIncrease: string;
  };
  signal?: AbortSignal;
}

export interface ConfirmResult {
  txpowId: string;
  status: 'confirmed' | 'timeout' | 'failed';
  blockHeight?: number;
  confirmingTxPowId?: string;
  /** Present when `expect` was supplied and evaluated. */
  balanceDelta?: { tokenId: string; before: string; after: string };
}
```

Behaviour:

1. Poll the node/Axia for the txpow record of `txpowId` until it **is a block**
   (`isblock === true` with a `header.block`), or `timeoutMs` elapses →
   `status: 'timeout'`. Explicitly check inclusion — do **not** treat “record
   exists” as confirmed (the extension's current `!error` check is the counter-
   example).
2. On inclusion, return `status: 'confirmed'` with `blockHeight` (and the
   confirming txpow id when available).
3. If `expect` is supplied, read the recipient balance before/after and evaluate
   the delta; a mismatch is reported (not silently passed).
4. `AbortSignal` cancels promptly (Canary teardown).

Recoverability: an optional `assertRecoverable` mode re-reads the txpow record
from the node (or, in wallet context, the receipt store) and fails if the node no
longer serves it — so a "confirmed" result also implies the node can still produce
the record.

### 6.3 Optional: `sendAndConfirm`

A thin convenience over §6.1/§6.2 for consumers who do want to block:

```ts
export async function sendAndConfirm(params: SendParams & ConfirmParams):
  Promise<SendResult & { confirmation: ConfirmResult }>;
```

`sendTransaction` stays non-blocking; this is the explicit settled variant.

### 6.4 Package identity corrections

- `packages/server/README.md`: title, `npm install`, and all `import … from
  '@totemsdk/node'` → `@totemsdk/server`.
- `packages/server/src/index.ts:2`: `@module @totemsdk/node` → `@totemsdk/server`.
- Add a README “Scope” note: **submission ≠ settlement**, with a `sendAndConfirm`
  snippet and a pointer to the Axia/wallet status decision (RFC-015 P4).
- The README's dependency note says “Dependency: `ws`”, but `package.json` also
  depends on `@totemsdk/storage` and `@totemsdk/txpow`; correct the note.
- Optional guard: a doc-lint assertion that the README/`@module` name equals
  `package.json.name` (extends the existing `validate-pkg-meta` surface, which
  already special-cases nothing for `server`).

### 6.5 README example correctness (found alongside)

The README examples do not compile against the package:

- `new MinimaClient({ nodeUrl: 'http://localhost:9005' })` (README:61,82) —
  `ClientConfig` requires `apiUrl` and has no `nodeUrl` (`packages/server/src/client.ts:20`).
- `new MinimaProvider(client)` (README:83) — `ProviderConfig` is a config object
  (`{ apiUrl, apiKey?, wsUrl? }`, `packages/server/src/provider.ts:8`), not a
  `MinimaClient`.
- `provider.getChainTip()` / `provider.getCoins(...)` (README:85-86) — `MinimaProvider`
  exposes a single `request(method, params)` router
  (`packages/server/src/provider.ts:36`), not those methods. These read like
  `ChainStateProvider` (`@totemsdk/chain-provider`) methods, which `MinimaProvider`
  does not implement.

Fix all four to match the real constructors and API (or, if `MinimaProvider` is
*meant* to be a `ChainStateProvider`, note that as a gap and align it — do not
leave examples that cannot run).

## 7. Security & privacy

- The verifier issues only read calls (block height, txpow status, balances); no
  key material, no signing.
- No secrets in logs; the existing `Authorization`/API-key rules apply.
- A timeout is not a failure of the transaction — it is a failure to **observe**
  it; the type must not collapse `timeout` into `failed`. (Distinct statuses.)
- Balance-delta verification reads public chain state; it is advisory evidence,
  explicitly labelled, never presented as a cryptographic proof.

## 8. Phasing

- **S0** — rename status contract (`settlement: 'unverified'`) + README/`@module`
  identity fixes + example fixes.
- **S1** — `awaitConfirmation` (poll inclusion, timeout, abort) + tests against a
  mocked provider (confirmed/timeout/abort).
- **S2** — `expect` balance-delta + recoverability checks + tests.
- **S3** — `sendAndConfirm` convenience + Canary wiring; docs cross-link RFC-015 P4.

## 9. Acceptance / verification

- A mocked provider reaching a confirming block yields `status: 'confirmed'` with
  `blockHeight`.
- A provider that never confirms yields `status: 'timeout'` after `timeoutMs`
  (not `failed`).
- `AbortSignal` cancels within one poll interval.
- `expect` mismatch is surfaced, not swallowed.
- README install/import lines use `@totemsdk/server`; a doc-lint check ties README
  name to `package.json.name`.
- Existing `sendTransaction` callers are unaffected except for the added
  `settlement` field.

## 10. Risks

| Risk | Mitigation |
|---|---|
| Consumers ignore `settlement: 'unverified'` | Distinct `awaitConfirmation` result; Canary asserts on it |
| Polling load on Axia | Default interval + timeout; exponential backoff option |
| `timeout` mistaken for `failed` | Separate status literals; documented |
| Identity rename breaks imports | It was already wrong; fix docs, keep `exports` map unchanged (package name already `@totemsdk/server`) |
| Duplicates RFC-014 receipt store | Scope: this is the server/node-side verifier; wallet receipts are RFC-014. Cross-reference, do not fork semantics |

## 11. Open questions

1. **Canonical status source.** Does `awaitConfirmation` poll the node directly
   (via `MinimaProvider`) or Axia (`/v1/transactions/:txpowid`, RFC-015 P4)? This
   RFC assumes the node via the provider and leaves the Axia path to RFC-015.
2. **Finality depth.** Minima inclusion is one block; should the helper wait N
   blocks for confidence?
3. **Balance delta timing.** Compare against the pre-send snapshot (already known
   in `sendTransaction`) or a caller-supplied baseline?

## 12. References

- RFC-014 (wallet receipts), RFC-015 §5.4 (status/receipts decision)
- RFC-005 (SDK/wallet gap fixes)
- `packages/server/src/{sendTransaction,client,provider,index}.ts`
- `packages/server/README.md`
- `packages/chain-provider/src/types.ts` (`ChainStateProvider`)
- `extensions/totem-extension/src/background/index.ts` (`pollTransactionConfirmation`, reference)
