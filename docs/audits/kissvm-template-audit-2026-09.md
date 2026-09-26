# KISSVM / Recursive-MAST / `tx-builder` source-level security audit (2026-09)

**Date:** 2026-09-24 (checked in 2026-09-26)
**Scope:** the complete stable template surface in `@totemsdk/kissvm`; the
experimental template families; the unique templates and policy-script builders
in `@totemsdk/recursive-mast`; the MAST/PREVSTATE/policy-anchor infrastructure;
the recursive-MAST → transaction/witness bridge; and `@totemsdk/tx-builder`.
**Machine check companion:** RFC-016 hardening contract.

> Note: path references have been normalized to the current tree. Some
> templates described as `kissvm/experimental` live at
> `packages/kissvm/src/templates/` and are re-exported via `templates/experimental.ts`.
> The MAST dual-root pair exists in **both** `kissvm/src/mast/` and
> `recursive-mast/src/`.

The stable KISSVM template set should **not** be treated as production-safe as
written. There are genuine authorization bypasses, economic invariants that are
not enforced, a split between legacy and canonical MAST roots, and serious
transaction/witness integration defects. The distinction matters because the
project README presents KISSVM as production while the package guide itself says
its stable templates have not received an independent audit. Minima makes the
security distinction clear: transaction inputs, outputs and state are separate,
and `VERIFYOUT` is the covenant mechanism for checking actual transaction
outputs.

## Executive result

| Area | Assessment | Main problem |
|---|---|---|
| `kissvm` evaluator | **Generally strong** | VM semantics exposed bugs in templates rather than causing them |
| `kissvm` stable templates | **Do not ship unchanged** | Multiple direct authorization/state-substitution failures |
| experimental templates | **Correctly marked experimental** | Several fail-open branches and economic/state bugs |
| Policy Anchor | **One of the strongest pieces** | Mostly fail-closed; residual dependence on branch quality |
| MAST compiler | **Canonical compiler looks strong** | Competes with an older noncanonical `policy-tree` root implementation |
| `recursive-mast` templates | **Unsafe/incomplete** | Incorrect MAST invocation plus false verification paths |
| recursive witness/signing glue | **Major fixes required** | Canonical MMR proofs are lost or mis-keyed |
| recursive transaction planners | **Major fixes required** | Anchor constructor does not lock the output to the anchor script |
| `tx-builder` multisig | **Major fixes required** | Invalid signatures can count toward `ready` |
| `tx-builder` funding proof | **Misnamed/overclaimed** | Proves signed intent, not an on-chain spend |

## 1. Critical: statechain timelock permits owner substitution

`packages/kissvm/src/templates/statechain.ts`:

```text
LET OWNER = STATE(ownerPort)

IF @COINAGE GTE timelock THEN
  RETURN SIGNEDBY(OWNER)
ENDIF
```

`STATE()` is the state supplied for the new transaction. The committed previous
owner is available through `PREVSTATE()`, but the reclaim branch never uses it.
After the timelock, an attacker can construct `STATE(ownerPort) = attackerPk;
SIGNEDBY(attackerPk)` and satisfy the reclaim condition. The stable test
reinforces the mistake by testing the owner in **current** `state`, rather than
testing that an attacker cannot replace the previous owner.

**Severity: CRITICAL.** Reclaim must authenticate against
`PREVSTATE(ownerPort)` or require strict owner-state continuity.

## 2. Critical: identity delegation template has no authorization

`templates/identity.ts::buildDelegationProofScript()`:

```text
LET delegatorPk = STATE(0)
LET delegatePk = STATE(1)
ASSERT SAMESTATE(0 2)
...
RETURN TRUE
```

There is no `SIGNEDBY(delegatorPk)`, no delegate signature and no fixed authority
signature. Preserving some state is not authentication. If used as an executable
MAST authorization branch, anyone able to reveal the branch can exercise it.

**Severity: CRITICAL.**

## 3. Critical: `buildActionAuthorizationScript()` does not authorize anyone

`templates/authority.ts`:

```text
LET nonce = STATE(...)
ASSERT PREVSTATE(...) NEQ nonce
ASSERT STATE(actionPort) EQ actionHash
ASSERT @BLOCK LTE windowEnd
RETURN TRUE
```

There is no signature at all, and the nonce merely has to differ (`NEQ`) rather
than increase monotonically — values can oscillate. The template proves an action
label and a time window but not who is permitted to act.

**Severity: CRITICAL.**

## 4. Critical: PaymentIntent does not enforce a payment

`templates/agent-policy.ts::buildPaymentIntentScript()` checks `STATE(20) LTE
limit` and `STATE(21) EQ allowedRecipient` but does not call `VERIFYOUT()`.
KISSVM's `@AMOUNT`/`@ADDRESS`/`@TOKENID` describe the **input** coin, whereas
`VERIFYOUT()` checks an actual output. An attacker can set the state claims while
constructing arbitrary outputs. There is also no signer. The template enforces
neither the payment amount nor its recipient.

**Severity: CRITICAL.**

## 5. Critical: proof delegation lets the spender choose both authorities

`templates/proof.ts::buildProofDelegationScript()`:

```text
LET delegator = STATE(0)
LET delegate = STATE(1)
ASSERT SIGNEDBY(delegator)
ASSERT SIGNEDBY(delegate)
```

Both keys come from mutable current state, so an attacker chooses
`STATE(0)/STATE(1)` and signs with them. Neither party is bound to
`config.authorityPk`, a previous-state identity, or a committed policy membership.

**Severity: CRITICAL.**

## 6. Critical: industrial-action escrow doesn't enforce escrow

`templates/industrial-action.ts::buildEscrowEnforcementScript()` checks condition
and amount equality and `SAMESTATE`, but has no signature, no beneficiary, no
payout, no `VERIFYOUT`, and no release condition tied to the real economic
output. It is an escrow *metadata check*. The companion `buildRevealScript()`
introduces a current-state preimage and then calls
`SAMESTATE(preimagePort, preimagePort)`, requiring the revealed preimage to have
already existed in previous state.

**Severity: CRITICAL if used as an authorization branch.**

## 7. Critical: provider heartbeat signer can be attacker-selected

`templates/provider-bond.ts::buildHeartbeatScript()`: when `probeSignerPk` is
configured it does not use it:

```text
LET probeSigner = STATE(probeSignerPort)
ASSERT probeSigner NEQ 0x00
ASSERT SIGNEDBY(probeSigner)
```

There is no `ASSERT probeSigner EQ configuredProbeSigner`. An attacker
substitutes their own key in state and signs. If `probeSignerPk` is omitted,
there is no signature at all.

**Severity: CRITICAL.**

## 8. Critical: TxPoW validation validates user-supplied claims, not TxPoW

`templates/txpow.ts::buildTxPoWValidationScript()` reads `txSize`, `ops`, `work`
from `STATE(...)` and compares them to thresholds. These are transaction state
variables, not real VM/network TxPoW measurements, so
`STATE(size)=1; STATE(ops)=1; STATE(work)=huge` passes. No authorization.

**Severity: CRITICAL as a security gate.** Either expose real TxPoW introspection
or rename to an *attested TxPoW metadata constraint* requiring a trusted attestor.

## 9. Critical: temporal decay enforces nothing

`templates/temporal.ts::buildDecayScript()` computes
`value = total * numerator / denominator` and returns `TRUE`; `value` is never
checked against an output or state transition. The rate-limit template has a
related problem: `periodBlocks` is effectively unused.

**Severity: CRITICAL if deployed standalone.**

## 10. High: linear/cliff vesting can be manipulated and over-vest

Linear/cliff read the schedule (`vestStart`, `vestEnd`, `total`) from **current
state** while reading the claimed amount from `PREVSTATE`, without requiring the
schedule fields to be unchanged. A beneficiary who can exercise the branch can
alter the schedule while claiming. Vesting is also not capped at `vestEnd`, so
`vested` can exceed `total`. The older `mast/prevstate.ts::vestingWorkflow()`
algebraically reduces to `vested = elapsed` and has no end/duration.

**Severity: HIGH.**

## 11. High: liquidity-bond payouts use the wrong semantics

`buildFeeAccrualScript()` does `ASSERT @AMOUNT LTE claimable` and
`VERIFYOUT(@INPUT governance @AMOUNT @TOKENID TRUE)` — using the entire **input**
amount, not "pay the claimable fee". `buildWithdrawalScript()` does
`VERIFYOUT(@INPUT @ADDRESS @AMOUNT @TOKENID TRUE)`, recreating the coin at the
same locking address (a rollover, not a withdrawal to the provider).

**Severity: HIGH.**

## 12. High: provider-bond challenge/release economics don't match their comments

`buildChallengeScript()` claims to require a challenger bond but only checks
`ASSERT @AMOUNT GTE disputeBondAmount` on the spent coin; it does not prove a
challenger-funded output. The "uphold" branch sends exactly `disputeBondAmount`
to the challenger; `treasuryPk` and `challengerRewardBps` are never used.
`buildBondReleaseScript()` recreates the coin at its existing address.

**Severity: HIGH.**

## 13. Critical experimental fail-open branches

`templates/energy.ts::buildRecTradingScript()` has three independent checks
(`issuance==1`; `issuance==0 AND retirement==0`; `retirement==1`) then
`VERIFYOUT(...)` and `RETURN TRUE`. Setting `issuance=2; retirement=2` executes
no authorization branch and reaches `RETURN TRUE`.
`templates/supply-chain.ts::buildBillOfLadingScript()` does the same with
`custody`. These must use fail-closed `IF / ELSEIF / ELSE RETURN FALSE`.

**Severity: CRITICAL.**

## 14. High: smart-contract execution has the same fail-open structure

`templates/legal.ts::buildSmartContractExecutionScript()` has independent
`IF performance==1` (both parties sign) and `IF breach==1` (arbiter signs)
blocks. Unless an oracle is configured, a transaction with `performance=0;
breach=0` requires neither party. The covenant survives, but the "execution"
branch runs without its supposed authorizers.

**Severity: HIGH.**

---

# Recursive-MAST findings

The retained `recursive-mast` templates are `access-control` and
`identity-verification`; most older templates are re-exported from KISSVM.
Delegation/cross-domain builders were also audited because they participate in
those templates.

### `verifyDelegationChain()` does not verify delegation proofs

`recursive-mast/src/delegation.ts` documents checking "valid Merkle proof" but
only checks chain continuity, script reconstruction, and script-hash equality.
It never verifies `link.proof` against `link.policyRoot`, then sets
`chain.verified = true`.

**Severity: CRITICAL at the SDK verification layer.**

### Access-control/identity scripts appear to MAST the public key, not the policy root

Both retained templates contain `ASSERT PROOF(operatorPk ... policyRoot ...
proof)` followed by `MAST 0x<operatorPk>`. KISSVM's `MAST <root>` treats its
operand as the **root hash** against which a `ScriptProof` is verified; the public
key is not that root, so the `PROOF` and `MAST` operations act on different things.

**Severity: HIGH (availability/interoperability).**

### Delegation expiry mixes wall-clock milliseconds and block height

`buildAccessDelegationChain()` sets `maxBlock: Date.now() + 86400000` while the
generated script compares to `@BLOCK` (block height), so the 24-hour delegation
effectively has a gigantic block-height expiry.

**Severity: HIGH.**

### Cross-domain required attributes are contradictory

For every required attribute it produces `ASSERT STATE(2) EQ "name"` and
`ASSERT STATE(2) EQ "jurisdiction"` — one port cannot equal two values, so
multiple required attributes make the policy unsatisfiable.

**Severity: HIGH (correctness/DoS).**

---

# The MAST architecture has two incompatible root systems

`mast/mast-compiler.ts` uses canonical Minima MMR construction (`mmrLeafExact`,
`ScriptMMR`, `MMRProof`, `calculateProofRoot`), while `mast/policy-tree.ts`
computes `policyRoot` using `SHA3(raw script UTF-8)` and an ordinary binary Merkle
tree. `buildLayeredPolicy()` consumes `policy-tree.ts` roots while
`verifyProofChain()` delegates to the canonical MMR compiler, so there are two
meanings of `policyRoot` in one package. Dangerous default:
`buildLayeredMastScript({layers: []})` returns `RETURN TRUE` (allow-all).

**Severity: HIGH overall; CRITICAL for the empty-policy default.** Delete the
home-grown Merkle implementation and make `compileMastTree()` the single
root/proof authority everywhere.

# Policy Anchor: comparatively good

`mast/policy-anchor.ts` reads committed roots from `PREVSTATE`, validates port
collisions at construction, whitelists action types, preserves unrelated roots
during rotation, advances epoch exactly +1, binds the successor anchor with
`VERIFYOUT(@INPUT @ADDRESS @AMOUNT @TOKENID TRUE)`, and fails closed at the
bottom. No equivalent trivial outsider-spend path was found. Its principal
residual risk is deliberate: recovery/emergency branches delegate authority to
the MAST branch, so weak templates behind those roots remain dangerous.

# Recursive transaction integration contains a critical anchor bug

`recursive-mast/src/transaction/anchor-transaction.ts`: `const script =
buildPolicyAnchorScript(config.anchorConfig);` is computed and then never used;
the sole output is `{ address: config.fundingAddress, amount: config.anchorAmount,
... }`. `createAnchorTransactionPlan()` does not lock the output to the Policy
Anchor script. `createRootRotationTransactionPlan()` imports root/epoch
authorizers but never uses them (`authorizerPkd`/`reason` unused; anchor action
selector/argument not populated). `createActionTransactionPlan()` takes
`action`/`subjectId` but doesn't bind the plan.

# Recursive witness construction is not canonical

`buildRecursiveWitnessPlan()` receives disclosed scripts with
`{script, scriptHash, mmrProof}` but discards `mmrProof`, doing
`mastBranches.set(ds.scriptHash, ds.script)`; `toEnhancedBuildParams()` builds
`{ script, scriptProof: ds.mmrProof, expectedRoot: '' }`. KISSVM's canonical MAST
evaluation expects `ScriptProof`s verified against the requested root. The bridge
should be consolidated around KISSVM's native `ScriptProof`.

# `tx-builder` audit

### Invalid multisig signatures count toward readiness

`multisig-manager.ts::addOwnSignature()` computes `valid` but stores the
signature whether or not it verified; `updateStatus()` uses
`signatureCount = tx.signatures.size` and marks `ready` at threshold, not
counting only `validated === true`. `importTransaction()` verifies imported
signatures but inserts them regardless and does not check configured-signer
membership. The node ultimately rejects a bad witness, so this is not automatic
L1 theft, but the SDK can falsely report readiness.

**Severity: HIGH.**

### New multisig transactions can sign the wrong digest

`createPendingTransaction()` accepts `transactionHex`/`transactionDigest` without
checking `SHA3(transactionHex) == transactionDigest` (the import path does check).

**Severity: HIGH.**

### `fund-tx` proves a signed intention, not an on-chain funding transaction

`PoolFundTx` (poolId, fundingCoinId, tokenId, amount, lpAddress,
recipientAddress, nonce) signed as canonical JSON proves the LP key signed those
claims — not that a transaction spent `fundingCoinId` into the pool. Rename
`DeepFundingProof` → `SignedFundingIntent` unless acceptance is accompanied by
independently verified on-chain spend evidence.

**Severity: HIGH semantic/security-boundary risk.**

### Minor

`selectCoins()` accepts negative targets; `-1` yields `selectedCoins=[]`,
`insufficientFunds=false`, `change=1`.

**Severity: MEDIUM.**

---

# Template-family disposition

| Template family | Result |
|---|---|
| `identity` | 🔴 Critical fixes |
| `authority` | 🔴 Critical fixes |
| `agent-policy` | 🔴 Critical fixes |
| `proof` | 🔴 Critical fixes |
| `statechain` | 🔴 Critical fixes |
| `temporal` | 🔴 Critical/high fixes |
| `txpow` | 🔴 Redesign |
| `industrial-action` | 🔴 Critical fixes |
| `provider-bond` | 🔴 Critical/high fixes |
| `liquidity-bond` | 🟠 High fixes |
| `governance` | 🟠 High fixes |
| `wots-lease` | 🟠 High fixes |
| `manifest` | 🟠 Fix fail-open empty permissions + continuity |
| `lookup-protocol` | 🟡 Mostly better; targeted fixes |
| `eltoo` | 🟡 No outsider bypass found; semantics need review |
| `firmware-update` | 🟡/🟠 substantially better than many templates |
| `payment-channel` | 🟡 substantially better (fixed multisig + output checks) |
| `state-machine` | 🟡 make permissionless mode explicit |
| `commercial` | 🟠 economic/output-binding review |
| `compliance` | 🔴 self-selected issuer/actor patterns |
| `data-privacy` | 🟠 state/output semantics |
| `device-lifecycle` | 🟠 key-rotation target not sufficiently bound |
| `energy` | 🔴 REC fail-open |
| `healthcare` | 🟠 cumulative-state bugs |
| `layers` | 🔴 allow-all / malformed multisig risks |
| `legal` | 🔴/🟠 fail-open contract execution |
| `recovery` | 🔴/🟠 placeholder governance keys + usage-limit bug |
| `rwa-lifecycle` | 🟠 distribution/redemption output bugs |
| `sensor-proof` | 🟠 freshness/state hardening |
| `supply-chain` | 🔴 BoL fail-open |
| `treasury` | 🟠 some "payments" roll over to self |
| `voting` | 🟠 quadratic credits not actually consumed |
| recursive `access-control` | 🔴 MAST/root correction required |
| recursive `identity-verification` | 🔴 MAST/root correction required |

## Remediation order

1. **Authorization invariant:** every executable branch authenticates a
   fixed/previously committed authority or explicitly declares itself
   permissionless; never derive authority solely from mutable `STATE`.
2. **Economic invariant:** payment/fee/escrow/release/distribution/redemption/
   withdrawal binds the actual output via `VERIFYOUT`; `STATE(amount)` is not payment.
3. **State invariant:** immutable commitments use `PREVSTATE`/`SAMESTATE`;
   transitions have an exact old → new relation.
4. **Fail-closed invariant:** replace independent conditional authorization
   blocks with exhaustive selection + `ELSE RETURN FALSE`.
5. **Canonical MAST only:** remove the parallel SHA3 Merkle-root implementation;
   use canonical MMR roots/proofs everywhere.
6. **Canonical witness only:** carry real `ScriptProof`s; never discard the MMR
   proof or substitute leaf hashes for roots.
7. **Repair anchor planning:** derive the Policy Anchor address from its locking
   script and construct that output.
8. **Repair multisig readiness:** validate the digest at creation and count only
   valid signatures from unique configured signers.
9. **Adversarial testing:** mutate signer-state, recipient, amount, token, every
   protected state port, transition selector and output independently and prove
   the transaction fails.

The existing stable tests are regression tests, not security tests: they run
template logic in `simulationMode` and mostly prove "a normal example passes and
an obvious bad example fails." What is missing is **invariant-directed
adversarial testing**.

Broad answer: **KISSVM itself is in considerably better shape than its template
library; the Policy Anchor is directionally strong; the main security debt is now
concentrated in template semantics plus the recursive-MAST/tx-builder integration
layer.** Fix that before adding any more templates. See RFC-016 for the contract
and phases.
