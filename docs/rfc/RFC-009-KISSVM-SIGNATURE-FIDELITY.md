# RFC-009: KISSVM Signature Fidelity — Minima-Faithful TreeKey SignatureProof Verification

**Status:** Draft — Phase 0/1 landed (witness model + evaluator tree-proof verification) and the RFC-008 on-chain gate passes
**Created:** 2026-09-21
**Authors:** Totem SDK Contributors
**Reviewers:** [Pending stakeholder assignment]

---

## 1. Summary

The SDK's KISSVM script validator (`@totemsdk/kissvm`, consumed by
`@totemsdk/tx-builder`) models transaction witnesses as a map from a 32-byte
public-key digest to a **flat Winternitz (WOTS) signature**, and implements
`SIGNEDBY` / `MULTISIG` / `CHECKSIG` with `wotsVerifyDigest(sig, txDigest, pkd)`.

Minima does **not** work that way. In Minima a witness holds `Signature`
objects, each a list of `SignatureProof`s (`{ publicKey, signature, mmrProof }`),
and the signer identity used by scripts is the signature's **root public key**
(`SignatureProof.getRootPublicKey()` — an MMR root, not a bare WOTS key).
`SIGNEDBY(pubkey)` is a membership check against those roots; the cryptographic
verification of each `Signature` happens as part of transaction validation.
This is how Minima wallet addresses (TreeKey roots) spend.

The SDK already models Minima's proof format in `@totemsdk/core`
(`SignatureProof`, `writeSignatureProof()` "per Java `SignatureProof.writeDataStream()`",
`verifyTreeSignature` / `verifyTreeSignatureDetailed`, `tx/types.ts`
`HierarchicalWitnessBundle`). Only the **validator's witness model and
verification** are out of step.

This RFC makes the KISSVM validator Minima-faithful: the witness carries
`Signature`/`SignatureProof` objects; `SIGNEDBY`/`MULTISIG`/`CHECKSIG` resolve a
signature's root public key and verify the proof chain. It is also the
prerequisite that unblocks RFC-008 Phase 1's on-chain witness (an SE TreeKey
root co-signature).

## 2. Motivation

### 2.1 The fidelity gap

| Aspect | Minima (Java, authoritative) | SDK validator today |
|---|---|---|
| Witness entry | `Signature` = `SignatureProof[]` | `Uint8Array` flat WOTS sig |
| Signer identity | `SignatureProof.getRootPublicKey()` (MMR root) | bare WOTS `pkd` |
| `SIGNEDBY(pk)` | membership over witness roots | `wotsVerifyDigest(sig, txDigest, pk)` |
| Tree signatures | supported (wallet addresses) | **rejected** |
| Multi-level proofs | supported (`TreeKey.verify`) | **rejected** |

Consequences:

- The SDK validator rejects any spend from a legitimate Minima TreeKey address,
  so the SDK's own scripts and witnesses are not byte-faithful to the network.
- RFC-008 Phase 1's SE identity (root + leased TreeKey leaves, `TreeSignature`)
  cannot be validated on-chain by the SDK evaluator — the exact blocker recorded
  as RFC-008 Open Question 1.
- Divergence is silent: the flat model is internally consistent, so it passes
  SDK tests while mis-modelling the chain.

### 2.2 Non-goals

- **No new signature scheme.** We reuse core's existing, Java-faithful
  `SignatureProof` / `verifyTreeSignature`.
- **No consensus change.** This aligns the SDK's validator with Minima, it does
  not alter consensus.
- **No weakening of verification.** The SDK's stricter inline crypto stays; we
  add the missing tree-proof path and a root-based key model.

## 3. Current State (verified)

### 3.1 SDK validator (the gap)

- `packages/kissvm/src/witness.ts:3-8` — `WitnessInput.signature` is documented
  as a "1088-byte flat WOTS signature"; `buildWitness` builds
  `Map<pkdHex, Uint8Array>`.
- `packages/kissvm/src/eval.ts:705-729` (`verifySignedBy`) and `:733-773`
  (`evalChecksig`) — verify with `wotsVerifyDigest(sig, txDigest, pkd)` only.
  `eval.ts:344-352` — `SIGNEDBY`/`MULTISIG` route through `verifySignedBy`.
- `packages/kissvm/src/simulate.ts` — `simulateSpend` is the validator entry
  point (fills `txDigest`, runs real verification).

### 3.2 SDK core already models Minima's proofs

- `packages/core/src/Streamable.ts:412-459` — `SignatureProof` interface,
  `writeSignatureProof()` "per Java `SignatureProof.writeDataStream()`",
  `writeSignature()` (array of proofs).
- `packages/core/src/mmr.ts:316-345` — `calculateProofRoot`, `verifyMMRProof`,
  and a comment citing Java `SignatureProof.getRootPublicKey()`.
- `packages/core/src/verify.ts` — `verifySignatureDetailed(...)`,
  `verifyTreeSignatureDetailed(...)` verify a tree signature against a root key.
- `packages/core/src/tx/types.ts:48-88` — `SignatureProofHex`,
  `HierarchicalWitnessBundle { proofs }`, `WitnessBundle`.
- `packages/core/src/treekey.ts` — `TreeKey.sign`, `verifyTreeSignature`,
  `getRootPublicKey`, `SignatureProof`.

### 3.3 Minima reference (authoritative Java)

- `org/minima/objects/keys/SignatureProof.java` — `{ mPublicKey, mSignature,
  mProof(MMRProof) }`; `getRootPublicKey()` reconstructs the root from the proof.
- `org/minima/objects/keys/Signature.java` — an ordered list of
  `SignatureProof`s; `getRootPublicKey()` = the first proof's root.
- `org/minima/objects/keys/TreeKey.java` — `sign(data)` returns a `Signature`
  (one proof per level, bottom-up: each level signs the next level's root, the
  last signs the data); `verify(data, signature)` checks depth-0 root against the
  tree public key, then each proof against the next proof's root, then the data.
- `org/minima/objects/keys/Winternitz.java` — leaf WOTS sign/verify
  (`Winternitz.verify(pubkey, data, sig)`).
- `org/minima/objects/Witness.java` — `ArrayList<Signature>`;
  `getAllSignatureKeys()` = each signature's `getRootPublicKey()`;
  `isSignedBy(pubkey)` membership.
- `org/minima/kissvm/Contract.java` — `checkSignature(HexValue)` is a membership
  test over the signer keys supplied to the contract;
  `org/minima/kissvm/functions/sigs/SIGNEDBY.java` calls it.

Local parity references already in-repo:
`packages/core/test-vectors/java-parity/` — `RunMinimaTreeKey.java`,
`TestVerifyMethod.java`, `TestTreeKeyVerifyOrder.java`, `TestMMRTreeParity.java`,
`TestTreeKeyParity.java`.

## 4. Minima Reference Semantics (normative for this RFC)

1. A witness is an ordered list of `Signature`s. Each `Signature` is an ordered
   list of `SignatureProof`s.
2. A `SignatureProof` carries `(publicKey, winternitzSignature, mmrProof)`.
   `getRootPublicKey()` = `mmrProof.calculateProof(MMRData.leaf(publicKey, 0)).data`.
3. A **flat** single-key signature is a `Signature` with one proof;
   a **tree** signature has one proof per level.
4. `TreeKey.verify(data, sig)`:
   - depth 0: `sig.proofs[0].getRootPublicKey() === treePublicKey`, else false;
   - for each non-last depth `i`: `Winternitz.verify(proofs[i].publicKey,
     proofs[i+1].getRootPublicKey(), proofs[i].signature)`;
   - last depth: `Winternitz.verify(proofs[last].publicKey, data,
     proofs[last].signature)`.
   - proof count is bounded (`TreeKey.MAX_KEY_LEVELS = 8`).
5. `SIGNEDBY(pk)` is true iff some witness `Signature` has
   `getRootPublicKey() === pk` **and** that signature is cryptographically
   valid over the transaction digest. (Minima splits "membership" at the opcode
   from "proof validity" at witness validation; the SDK keeps both checks and
   performs them together — see §5.4.)

## 5. Design

### 5.1 Witness model

Extend the validator witness so a signing entry is a full Minima `Signature`
(one or more `SignatureProof`s), not only a flat byte string:

```ts
// @totemsdk/kissvm (and core-compatible)
export interface WitnessSignature {
  /** Minima Signature = one proof per level (flat = a single proof). */
  proofs: SignatureProof[];
}
export interface ScriptWitness {
  /** keyed by root public-key hex (lower-case, no 0x) */
  signatures: Map<string, WitnessSignature>;
}
```

`buildWitness` accepts, per entry, either:
- `{ proofs }` — a Minima `Signature` (preferred), or
- `{ pubkeyHex, signature }` — a flat WOTS signature over `txDigest` (convenience;
  normalised to a single-proof signature by `createFlatSignatureProof`), so
  existing callers keep working.

The **key** is the signature's `getRootPublicKey()` (computed via core's
`getRootPublicKey(proof)`) — never the caller's claimed key.

### 5.2 Verification

Add a single verification helper used by `SIGNEDBY`, `MULTISIG`, `CHECKSIG`:

```ts
function verifyWitnessSignature(
  entry: WitnessSignature,
  txDigest: Uint8Array,
  expectedKey: Uint8Array,   // script's 32-byte key (root)
): boolean
```

- Reject when `entry.proofs.length === 0` or `> MAX_KEY_LEVELS (8)`.
- `entry.proofs[0].getRootPublicKey()` must equal `expectedKey` (this is the
  Minima `checkSignature` membership, done on the reconstructed root, not on a
  caller-supplied value).
- Verify the proof chain with core's `verifyTreeSignatureDetailed(expectedKey,
  txDigest, { proofs })`; a single flat proof takes the leaf branch
  (`wotsVerifyDigest(proof.signature, txDigest, proof.publicKey)`).

`verifySignedBy(pk, vm)` → look up `vm.witness.signatures.get(normalized(pk))`,
then `verifyWitnessSignature`. `MULTISIG(k, keys…)` counts keys that pass.
`CHECKSIG` mirrors `SIGNEDBY` (0-arg form: any witness proof that verifies).

### 5.3 Root-based key model (flat = single proof)

Because `getRootPublicKey()` for a single leaf equals
`calculateProofRoot(MMRData.leaf(pubkey, 0), emptyProof)`, a **flat** WOTS key is
represented as a one-proof `Signature`. Scripts that bind a bare WOTS pkd keep
working: `buildWitness({ pubkeyHex, signature })` wraps the flat sig into a
one-proof signature whose root is computed by core, and verification falls back
to `wotsVerifyDigest` for the single-proof case. Tree-key scripts bind the
**MMR root**; their signature carries the full proof chain.

### 5.4 Keep the SDK stricter than Minima

Minima's opcode does presence/membership and defers crypto to witness
validation. The SDK validator has no separate witness-validation stage, so it
must do **both** here (as it does today): a signature only counts if it is a
member **and** cryptographically valid. We preserve `simulationMode` for
script-logic unit tests (presence-only) but it must never be reachable from
`simulateSpend` or production.

### 5.5 Wire format

Reuse core's Java-faithful serialization — no new format:
`writeSignatureProof` / `writeSignature` (`core/Streamable.ts`) and the
`HierarchicalWitnessBundle` shape (`core/tx/types.ts`). `tx-builder` and
`statechain` emit witnesses in that shape so a Minima node reads them directly.

### 5.6 Impact on RFC-008 Phase 1

With tree proofs supported, the statechain cooperative branch can bind the SE
**root** and the witness carries the SE's leased-leaf `Signature`; the
RFC-008 `simulateSpend` gate (§7) then validates the on-chain witness and Open
Question 1 closes. (The alternative — flat per-state leaf pkds — remains
available but is the less-faithful model.)

## 6. Phases

| Phase | Scope | Acceptance gate |
|---|---|---|
| **0** | Witness model: introduce `WitnessSignature`; `buildWitness` accepts tree proofs and normalises flat signatures to a one-proof signature via core | Unit tests: flat and tree witnesses construct; key is the computed root |
| **1** | Evaluator: `verifySignedBy`/`MULTISIG`/`CHECKSIG` use `verifyWitnessSignature` (root membership + proof-chain verification); enforce `MAX_KEY_LEVELS`; `simulationMode` never in `simulateSpend` | `simulateSpend` accepts a real TreeKey signature against its root; rejects wrong root, wrong data, tampered proof, over-deep proof; flat path unchanged |
| **2** | Cross-impl parity: replay Minima Java golden vectors (in-repo `java-parity` generators + `minima-global/Minima` `SignatureProof`/`TreeKey`) through the SDK evaluator | Golden vectors verify identically; a witness produced by the SDK verifies against the node evaluator and vice-versa |
| **3** | Consumers: `tx-builder`/`statechain` emit `HierarchicalWitnessBundle` witnesses; `statechain.buildStatechainScript` binds the SE root; `claim.ts` builds the tree witness | End-to-end: `simulateSpend(script, coin, ctx, treeWitness)` passes for the RFC-008 SE root co-signature; reclaim path unchanged |

### 6.1 Status (2026-09-21)

**Landed (Phase 0 + Phase 1 + the §7 gate).**

- `packages/kissvm/src/types.ts` — `ScriptWitness.signatures` is now
  `Map<string, Uint8Array | TreeSignature>` (flat or Minima tree signature).
- `packages/kissvm/src/witness.ts` — `buildWitness` accepts `{ proofs }` tree
  signatures and keys them by the **computed root public key**
  (`getRootPublicKey(proofs[0])`), never a caller-supplied key; flat entries
  keep the existing behaviour.
- `packages/kissvm/src/eval.ts` — `verifySignedBy` and `CHECKSIG` route through
  `verifyWitnessSignature`: flat entries use `wotsVerifyDigest`; tree entries
  use core's `verifyTreeSignature` (root reconstruction + proof chain), with a
  `MAX_KEY_LEVELS = 8` depth bound. `simulateSpend` still never sets
  `simulationMode`.
- `packages/statechain/src/__tests__/onchain-witness.test.ts` — the §7 gate:
  real `TreeKey` owner + SE, `buildStatechainScript(<SE-root>)`, and
  `simulateSpend` accept the cooperative spend and reject a missing SE
  signature, an imposter SE, and a wrong digest; the owner-only reclaim path is
  unchanged. **5/5 passing.**
- Suites: kissvm 220/220, statechain 120/120; workspace gates green.

**Outstanding.**

- Phase 2 (cross-impl golden vectors against the Minima Java / node evaluator)
  and Phase 3 (wire `tx-builder`/`statechain.claim.ts` to emit the tree witness
  end-to-end) remain.
- RFC-008's `SeIdentity` produces `TreeSignature`s, but the statechain client
  still builds flat witnesses for claims; Phase 3 wires the tree witness into
  the claim path.

## 7. Acceptance Gate (the RFC-008 blocker)

A conformance test that:

1. Builds a `SeIdentity` (RFC-008), leases a leaf, and produces a `TreeSignature`
   over a statechain claim `txDigest`.
2. Builds the statechain script `MULTISIG(2 STATE(0) <SE-root>)` with
   `buildStatechainScript`.
3. Runs `simulateSpend(script, coin, ctx, buildWitness([...tree witness...]))`.
4. Expects `true`; and expects `false` for a wrong leaf, a substituted root, a
   tampered proof, and a signature over a different digest.

## 8. Security & Correctness

- **Fail closed.** No proof, wrong root, over-deep proof, malformed MMR proof, or
  a signature that does not verify ⇒ `false`. Never `true` on presence alone in
  production.
- **Root, not claim.** The signer key is always recomputed from the proof; a
  caller cannot declare a privileged key it did not sign with.
- **Bound proof depth** (`MAX_KEY_LEVELS = 8`) to match Minima and prevent
  pathological inputs.
- **Parity, not approximation.** Verification must match
  `org.minima.objects.keys.TreeKey.verify` and `Winternitz.verify` byte-for-byte;
  core already carries Java-parity MMR leaf/parent hashing (`mmr.ts`).
- **Regression guard.** The flat path remains covered by the existing `SIGNEDBY`
  tests; the tree path is additive.

## 9. Open Questions

1. **Flat representation.** Confirm that a single-proof `Signature` with an
   empty MMR proof is the canonical "flat" form, or whether flat keys should
   instead be bound as level-1/level-0 tree roots. (Resolve against Java
   `MMRData`/`MMRProof` and core's `createMMRDataLeafNode` parity tests.)
2. **`CHECKSIG` 0-arg semantics.** Match Minima's exact behaviour for the
   0/1/2/3-parameter forms when tree proofs are present.
3. **Scope of witness validation.** Whether to also model Minima's
   "verify all witness signatures at transaction validation" stage separately
   from the opcodes, or keep the SDK's inline-and-stricter model (recommended).
4. **`tx-builder` surface.** Which public entry validates a full TxPoW witness
   (versus `simulateSpend`), so downstream callers have one obvious validator.

## 10. References

- Minima (authoritative Java, `minima-global/Minima`):
  `src/org/minima/objects/keys/SignatureProof.java`,
  `Signature.java`, `TreeKey.java`, `Winternitz.java`,
  `src/org/minima/objects/Witness.java`,
  `src/org/minima/kissvm/Contract.java`,
  `src/org/minima/kissvm/functions/sigs/SIGNEDBY.java`.
- SDK core: `packages/core/src/Streamable.ts`,
  `packages/core/src/mmr.ts`, `packages/core/src/verify.ts`,
  `packages/core/src/treekey.ts`, `packages/core/src/tx/types.ts`.
- SDK validator: `packages/kissvm/src/{eval,witness,simulate}.ts`;
  `packages/tx-builder/src/wasm-bridge.ts`.
- In-repo Java parity: `packages/core/test-vectors/java-parity/`.
- RFC-008: Federated Statechain — Phase 1's on-chain witness (Open Question 1)
  depends on this RFC.
