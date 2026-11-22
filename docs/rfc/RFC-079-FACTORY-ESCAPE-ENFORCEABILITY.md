# RFC-079: Factory Escape State Enforceability

**Status:** Accepted decision — checkpoint fallback specified, contestable mode
conditional on a real-node KISSVM proof.
**Date:** 2026-11-18
**Supersedes:** nothing. **Blocked-by:** OMN-057/OMN-058, OMN-064.
**Related:** RFC-009 (KISSVM signature fidelity), RFC-016 (template security),
RFC-048 (port budgets), RFC-078 (authorization hardening).

## 1. Decision

Omnia factory settlement must pay a **cryptographically authenticated,
enforceable factory state**, not the immutable funding allocation.

The target design is a versioned, challengeable unilateral settlement protocol:
monotonically increasing state sequences, bounded contest windows, independent
recovery certificates, and verified distribution outputs.

Deployment of that design is **conditional** on:

1. detached-certificate signature verification on a real Minima node *and* in
   both SDK evaluators;
2. bounded contest deadlines derived from an authoritative height;
3. successor continuity and value conservation enforceable in KISSVM;
4. final distribution verified against the committed allocation.

Until those hold, **only confirmed on-chain state checkpoints may establish
enforceable allocation changes**, and dynamic off-chain factory value transfers
stay release-blocked.

OMN-058 therefore remains **open / critical**. This RFC is the design record,
not a closure.

## 2. Measured feasibility (spike, commit 63f1cada)

The spike lives in
`tests/unit/kissvm/src/__tests__/factory-escape-feasibility.test.ts`. It records
observed behaviour, so a failure there is a real blocker, not a flaky test.

| Question | Result | Evidence |
|---|---|---|
| Can a covenant authenticate a detached state certificate without fresh counterparty signatures? | **Yes** | OMN-064 fixed the semantics, OMN-065 closed the evaluator gap: both TS and Rust/WASM verify canonical tree signatures and flat WOTS over the supplied data. |
| Can a covenant require a strictly higher sequence plus a matching commitment? | **Yes** | `ASSERT nextSeq GT prevSeq` and `ASSERT STATE(102) EQ <commitment>` both evaluate; the whole contest branch uses 8 instructions of the 1024 budget. |
| Can it enforce value conservation on the successor? | **Yes** | `VERIFYOUT(0 @ADDRESS @AMOUNT @TOKENID TRUE)` rejects an inflated output. |
| Can the successor member/balance root be recomputed on chain? | **Arithmetic only** | A statically unrolled 4-leaf recompute costs 17 instructions. The blocker is input, not cost: no opcode exposes an arbitrary witness proof element as a script value, so siblings cannot be fed in. |
| Does the current escape branch pay stale shares? | **Yes — defect** | A script that pays `PREVSTATE(128)` after the timeout passes even when the participant already signed a lower allocation at a later sequence. |

Known parity caveat: WOTS verification is mocked in the workspace's KISSVM test
config, so the spike measures **dispatch and structure**, not the cryptographic
primitive. Signature fidelity itself is RFC-009/RFC-016 work and must be
re-proven on a node.

### 2.1 The CHECKSIG gap — resolved (OMN-064)

The reference implementation settles the question without a node:

```
// src/org/minima/kissvm/functions/sigs/CHECKSIG.java
checkExactParamNumber(3);
HexValue pubkey = getHexParam(0); HexValue data = getHexParam(1); HexValue sig = getHexParam(2);
TreeKey checker = new TreeKey(); checker.setPublicKey(pubkey.getMiniData());
return new BooleanValue(checker.verify(data.getMiniData(), Signature.convertMiniDataVersion(sig.getMiniData())));
```

Exactly three parameters, verified against `data`; the contract witness and the
transaction digest are never consulted. `SIGNEDBY` is the witness path, and
`MULTISIG` iterates the keys it is given.

The SDK evaluators had conflated the two (`CHECKSIG` behaved like `SIGNEDBY`
while accepting the three-argument form). Both now follow the reference:

- `CHECKSIG` requires exactly three HEX operands, rejects zero-length and
  non-hex operands, and verifies the signature over the data.
- TypeScript verifies canonical tree signatures and flat WOTS.
- Rust/WASM verifies the same two forms: core-wasm deserializes `TreeSignature`
  (`Signature.readDataStream`) and CHECKSIG tries it before flat WOTS (**OMN-065**).
- `tests/unit/kissvm-parity` runs the same fixtures through TypeScript and the
  Rust/WASM artifact; `scripts/kissvm-node-parity.mjs` runs them against a live
  node's `runscript` when `MINIMA_RPC_URL` is set.

Consequence: the earlier "pre-signed raw transaction" objection still stands,
but the *detached certificate* half of the contest protocol is now expressible.

## 3. Target architecture

```
funding UTXO (locked funds · participant root · initial state)
  ├── cooperative close   N-of-N signatures, immediate settlement
  └── unilateral exit     signed recovery certificate
        └── contest UTXO (sequence · state root · deadline)
              └── challenge window: a strictly higher valid sequence replaces it
                    └── final distribution: pays the winning state
```

A unilateral exit **starts a settlement**; it never immediately pays the
original contributors.

### 3.1 Recovery state

```ts
interface FactoryRecoveryState {
  version: 1;
  chainId: string;
  factoryId: string;
  fundingCoinId: string;
  sequence: bigint;
  partyRoot: string;
  tokenId: string;
  tokenScale: number;
  totalValue: bigint;
  allocations: Record<string, bigint>;
  /** Enforceable financial state of every outstanding VC, not just its id. */
  virtualChannelCommitments: { channelId: string; stateDigest: string; sequence: bigint }[];
  distributionRoot: string;
  settlementPlanHash: string;
}
```

A certificate is valid only when the complete N-of-N authorization verifies,
all token amounts conserve value, and the settlement package implements the
committed distribution. Unresolved VCs/HTLCs retain value in a separately
enforceable output; they cannot disappear from accounting.

Certificates must be durable **before** the SDK reports the update as final.

### 3.2 Dispute rules

1. A stale state may be presented first; it only creates a contest coin.
2. The challenger presents a complete certificate with a strictly higher
   sequence. No fresh signature from the first presenter is required.
3. The deadline is a fixed contest window (or a strictly bounded extension);
   it is never chosen by the challenger to extend indefinitely.
4. After expiry with no higher valid state, distribution executes from the
   winning state, with fees explicitly accounted.

Security statement: latest-known-state security **under the challenge-window
liveness assumption**. If everyone holding the newest state is offline, the
globally newest state does not necessarily win. Monitoring or delegated
watchtowers are required; this is not a claim of unconditional finality.

## 4. Checkpoint fallback — implemented

If the contest covenant is not implementable, the enforceable baseline is:

- every finalized allocation change **consumes** the factory UTXO and creates a
  successor at the same script with updated `STATE(128+k)` balances, party and
  balance roots, and an advanced sequence;
- the previous version becomes unspendable (same-script successor continuity,
  no double-spend of a checkpoint);
- the escape branch pays the **latest checkpoint**, and value conservation is
  enforced against the spent coin.

Cost: one on-chain transaction per allocation change. That is the price of
enforceability without on-chain certificate verification. It must be stated in
the product docs, not hidden.

Status: `buildFactoryCheckpoint`, `assertFactoryCheckpointTransition` and the
`enforceCheckpoints` covenant option ship the mechanism (`omnia-factory`),
together with `FACTORY_CHECKPOINT_SEQUENCE_PORT` (`STATE(104)`, seeded at
funding). The covenant then requires, on every non-settlement spend:

```
ASSERT STATE(104) EQ INC(PREVSTATE(104))
ASSERT VERIFYOUT(@INPUT @ADDRESS @AMOUNT @TOKENID TRUE)
ASSERT SAMESTATE(111 111)
```

Checkpoint mode is **opt-in** (`buildFactoryOpening(..., { enforceCheckpoints: true })`),
so the off-chain design keeps working, with OMN-058 open until the contestable
protocol lands. Enabling it by default is the deployment decision that turns
"off-chain value is enforceable" into a true statement.

## 4A. Output-enforced full distribution — implemented

The timeout path now has two complementary settlement branches:

- **per-party escape** — one participant withdraws its committed share; the
  remainder stays at the factory script with the other shares unchanged, and the
  withdrawing port is zeroed;
- **full distribution** — one participant settles the whole factory in a single
  transaction paying every committed share.

The distribution branch does not trust the transaction to describe its own
payouts. Every amount is read from the spent coin, and the covenant pins the
shape:

```
IF @BLOCK GT PREVSTATE(103) THEN
  IF @TOTIN EQ 1 THEN
    IF @TOTOUT EQ N THEN
      IF GETOUTADDR(N-1) EQ <last payout address> THEN
        ASSERT @INPUT EQ 0
        ASSERT PREVSTATE(128) + … + PREVSTATE(128+N-1) EQ @AMOUNT
        ASSERT VERIFYOUT(0 <addr_0> PREVSTATE(128) @TOKENID FALSE)
        … one per participant …
        ASSERT (SIGNEDBY(pk_0) OR … OR SIGNEDBY(pk_N-1))
        RETURN TRUE
```

Consequences:

- a redirected, resized, missing or extra payout fails;
- one signature triggers settlement — no counterparty liveness, and N-of-N is
  no longer what authorizes the payout set;
- the amounts come from the latest **confirmed** allocation (funding coin or
  checkpoint), never from a caller-supplied map;
- the `GETOUTADDR(N-1)` gate keeps the per-party escape working: a partial exit
  leaves the remainder at the script address, so this branch is skipped and the
  per-party branch handles it.

The branch is now part of the **funded** covenant by default:
`buildFactoryOpening()` / `createFactory()` build with
`settlement: 'full-distribution'`, and the host exposes the same switch
(`settlement: "per-party"` opts out to the smaller covenant,
`enforceCheckpoints: true` additionally pins allocation changes to a checkpoint
transaction). Pre-release: no migration is provided; factories created before
this change are test artefacts and are recreated.

Checkpoint enforcement is also the default (OMN-058): the cooperative branch
only accepts a checkpoint transaction (same script, same value, sequence + 1).
Because a unilateral escape reads `PREVSTATE`, that is what keeps the payout set
equal to the latest committed allocation. Off-chain allocation changes —
virtual-channel open/close and `reallocate()` — are refused on a checkpointed
factory until the change is committed as a checkpoint; committing it from the
host is the remaining automation. `enforceCheckpoints: false` is an explicit
opt-out for factories that will not rely on unilateral exits.

Zero committed shares are rejected rather than skipped. The covenant is built
once, at funding, and pins one output per participant (`@TOTOUT EQ N` with
`VERIFYOUT(k … PREVSTATE(128+k))`); a zero share would require a zero-value
output, which Minima rejects (`0 < amount`). Rather than weaken the check or
emit an unsatisfiable branch, `factoryDistributionPayouts()` fails closed and
names the alternatives: rebalance with a checkpoint, or use the per-party
escape for the other shares. Supporting dynamic zero shares needs a different
covenant (a non-zero-share count cannot be computed in KISSVM); it is not
claimed here.

Measured cost (executed instructions, KISSVM evaluator, limit 1024):

| participants | cost |
|---|---|
| 2 | 47 |
| 3 | 59 |
| 5 | 83 |
| 10 | 143 |

The combined funding covenant (cooperative + per-party + distribution) measures
55 / 67 / 91 / 151 instructions for 2 / 3 / 5 / 10 participants — about 8 more
than the distribution branch alone.

That is roughly 12 instructions per participant. Against the RFC-048 MASH
composite reservation (≈855–871) the arithmetic still fits at 10 participants
(≈1014), but with under 10 instructions of headroom. Until a node run measures
the composite, treat **≤5 participants as comfortable and 10 as requiring
measurement**, and do not weaken the checks to preserve an O(1) claim.

`buildFactoryPresignedDistributionScript` keeps the old signature-authorized
compact mode for a dedicated distribution coin. It is documented as such and is
**not** an allocation verifier.

Remaining gaps in this mode:

- open virtual channels are rejected (`assertFactoryDistributable`) rather than
  paid to separately enforceable outputs;
- only confirmed allocations are enforceable; newer off-chain states still need
  the contest protocol;
- the funding address changes when the settlement branch is enabled; pre-release
  factories are recreated rather than migrated.

## 5. Implementation changes required

| Location | Change |
|---|---|
| `omnia-factory/src/script.ts` | Replace the old-share unilateral payout with either (a) a contest transition + bounded deadline + distribution verification, or (b) checkpoint continuity: same-script successor, advanced sequence, conserved value. |
| `omnia-factory/src/commitment.ts` | Commit to complete VC exposure and the exact settlement outcome. |
| `omnia-factory/src/factory.ts` | Every committed transition produces and durably retains a recovery certificate/checkpoint. |
| `omnia-factory/src/virtual.ts` | VC open/update/close update the recoverable economic state. |
| `omnia-factory/src/distribution.ts` | `buildFactoryDistributionScript()` currently pins `STATE(112)` and authorizes N-of-N after the timeout without checking outputs. It must verify the distribution or be removed from the settlement path. |
| `packages/kissvm` | **Done (OMN-064):** `CHECKSIG` implements the reference three-argument form in TypeScript and Rust, with a TS/Rust parity suite. |
| `packages/core-wasm` | **Done (OMN-065):** `deserialize_tree_signature` implements the `Signature.readDataStream` layout; the Rust CHECKSIG branch uses it. |

## 6. Acceptance tests (all must be real, not mocks)

1. A stale state loses to a newer authorized state within the window.
2. Signatures cannot be replayed across funding coins or factories.
3. Unresolved VCs/HTLCs retain recoverable value after escape.
4. All exit outputs conserve value, including fees.
5. A crash or partition does not erase the winning recovery certificate.
6. Real Minima proofs and signature verification, on a node and in both SDK
   evaluators. The node leg is `scripts/kissvm-node-parity.mjs` (requires
   `MINIMA_RPC_URL`); the evaluator legs run in `pnpm --filter @totemsdk/kissvm test`.

## 7. Consequences

- Factories must not be advertised as a place to move value off-chain until
  §6 passes.
- The release gate keeps OMN-058 blocking.
- The checkpoint fallback is the only acceptable interim posture; a nominal
  "escape pays original shares" fix is rejected because it would preserve the
  custody defect while looking green.
