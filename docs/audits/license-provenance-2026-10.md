# License Provenance Audit — 2026-10

**Status:** Engineering audit — not legal advice

**Scope:** Totem SDK repository at commit `5157de50`

**Question:** Is the current MIT-only licensing consistent with the code's provenance?

**Contributor status:** The repository is presently maintained by a single contributor,
so contributor consent is not the blocking issue. The blocking issue is source
provenance.

---

## 1. Executive summary

The repository is **not a clean-room reimplementation** of Minima. It contains a
substantial, source-aligned translation of Minima's Apache-2.0 Java implementation,
especially in:

- `@totemsdk/core`
- `@totemsdk/core-wasm`
- `@totemsdk/kissvm`
- `@totemsdk/txpow`
- `@totemsdk/tx-builder`
- `@totemsdk/server` wallet code

The code is generally **not a verbatim copy** of Minima Java files. It is a
translation/adaptation into TypeScript and Rust, with explicit references to
Minima classes, line numbers, field order and algorithm details. Under copyright
law, a translation or adaptation of protected code is still a derivative work.
That distinction matters more than whether the text is identical.

**Finding:** The current MIT-only packaging is likely incomplete for the
Minima-derived portions. Apache-2.0 attribution and notice obligations appear to
apply. The safest engineering conclusion is:

> Treat the Minima-derived portions as Apache-2.0-derived code. Do not describe
> the SDK as clean-room.

Because the project has a single contributor, relicensing the original portions
is feasible. The recommended destination is **Apache-2.0 for the public SDK**,
with a `NOTICE` file and third-party notices. Existing published MIT releases
remain MIT; the change applies to new releases.

This audit is not a legal opinion. A lawyer should review the translation
question, the Bouncy Castle obligations and the QVAC type declarations before the
license change is announced.

**Resolution (2026-10-21):** The public SDK has been relicensed to Apache-2.0 for
new releases. Root and package `LICENSE` files, package metadata, Cargo manifests
and the `NOTICE` file have been updated. Existing releases published under MIT
remain available under their original license.

---

## 2. Method

1. Searched the repository for provenance markers: `Minima`, `org.minima`,
   `.java`, `matching`, `ported`, `source-aligned`, `from ...java`.
2. Read the flagged files and compared their constants, field order, algorithms
   and comments with Minima's Java source.
3. Fetched representative Minima files from
   `minima-global/Minima` for comparison:
   - `TreeKeyNode.java`
   - `MMRData.java`
   - `MiniNumber.java`
   - `Contract.java`
4. Checked third-party assets and generated code for license headers.
5. Checked package metadata, `LICENSE` files, `CONTRIBUTING.md` and README
   licensing claims.
6. Checked the declared licenses of code-generating dependencies where relevant.

Limitations:

- This was a source review, not a legal opinion.
- Not every one of the ~1,365 source files was compared line-by-line against
  Minima. The flagged surface is large enough to establish the pattern.
- "No verbatim copy found" means exactly that. It does not mean "no derivative
  work".

---

## 3. Findings

### F1 — Core cryptography and serialization are Minima-derived (High confidence)

**Packages:** `core`, `core-wasm`

**Files with explicit Minima source references:**

- `packages/core/src/treekey.ts`
- `packages/core/src/wots.ts`
- `packages/core/src/mmr.ts`
- `packages/core/src/javaStreamables.ts`
- `packages/core/src/Streamable.ts`
- `packages/core/src/MiniNumber.ts`
- `packages/core/src/transaction.ts`
- `packages/core/src/bip39.ts`
- `packages/core/src/minima32.ts`
- `packages/core/src/address-derivation.ts`
- `packages/core/src/minimaWireSerializer.ts`
- `packages/core/src/tx/TransactionService.ts`
- `packages/core-wasm/src/treekey.rs`
- `packages/core-wasm/src/wots.rs`
- `packages/core-wasm/src/mmr.rs`
- `packages/core-wasm/src/java_streamables.rs`
- `packages/core-wasm/src/streamable.rs`
- `packages/core-wasm/src/transaction.rs`
- `packages/core-wasm/src/bip39.rs`
- `packages/core-wasm/src/minima32.rs`
- `packages/core-wasm/src/derive.rs`

**Evidence:**

- `treekey.ts` says it matches `TreeKey.java` and `TreeKeyNode.java` and cites
  specific Java line ranges for key generation, MMR leaf construction and MMR
  parent construction.
- `mmr.ts` says it is a "Full MMR implementation matching Minima's `MMR.java`,
  `MMRData.java`, and `TreeKeyNode.java`".
- `Streamable.ts` lists the Java reference classes and exact wire formats.
- `wots.ts` says it matches BouncyCastle's `WinternitzOTSignature` and names the
  exact BouncyCastle classes.
- `MiniNumber.ts` says it matches `org.minima.objects.base.MiniNumber` with
  `MathContext(64, RoundingMode.DOWN)`.
- `transaction.ts` says it matches `Transaction.writeDataStream()` and
  `Coin.writeDataStream()` exactly.
- `address-derivation.ts` cites `Wallet.java createNewKey()` and the
  per-address derivation rules.
- `bip39.ts` cites Minima's `BIP39.java` behavior and uses the BIP39 English
  word list.

The local implementations differ syntactically from Java: TypeScript classes,
`bigint`, Rust structs and WASM. They implement the same constants, serialization
order and algorithms. This is the profile of a translation/adaptation, not an
independent clean-room implementation.

**Risk:** High. Apache-2.0 attribution and notice obligations likely apply.

---

### F2 — KISSVM is a source-aligned port (High/Medium confidence)

**Package:** `kissvm`

**Flagged files include:**

- `packages/kissvm/src/MiniNumber.ts`
- `packages/kissvm/src/eval.ts`
- `packages/kissvm/src/parser.ts`
- `packages/kissvm/src/lexer.ts`
- `packages/kissvm/src/vm.ts`
- `packages/kissvm/src/mast/mast-compiler.ts`
- `packages/kissvm/src/mast/prevstate.ts`
- `packages/kissvm/src/mast/proof-chain.ts`
- `packages/kissvm/src/simulate.ts`
- `packages/kissvm/src/GUIDE.md`

**Evidence:**

- `MiniNumber.ts` explicitly mirrors Java's `org.minima.objects.base.MiniNumber`.
- `GUIDE.md` records a specific `minima-global/Minima` source snapshot and
  describes the function registry and execution path.
- `mast-compiler.ts` cites Minima `Address.java` and `MMRSet.java` and describes
  the same peak-bagging algorithm.
- The evaluator implements the same operation families, limits and error
  semantics.

The KISSVM *templates* in `packages/kissvm/src/templates/` appear to be original
Totem work. The VM and serialization core are the derivative surface.

**Risk:** High/Medium. Treat the VM core as Minima-derived; treat the templates as
original unless a specific template is later found to be copied.

---

### F3 — Transaction, TxPoW and wallet code are derivative (High confidence)

**Packages:** `txpow`, `tx-builder`, `server`

**Flagged files:**

- `packages/txpow/src/serialization.ts`
- `packages/txpow/src/admission/template.ts`
- `packages/txpow/src/admission/mine.ts`
- `packages/tx-builder/src/fund-tx.ts`
- `packages/tx-builder/src/multisig-manager.ts`
- `packages/server/src/wallet.ts`
- `packages/server/src/sendTransaction.ts`

**Evidence:**

- `txpow/serialization.ts` documents the exact Java `TxHeader`, `TxBody` and
  `TxPoW` field order and says it ports the extension's builder, which itself is
  Minima-parity code.
- `transaction.ts` explicitly matches Minima's transaction and coin stream
  serialization.
- `server/src/wallet.ts` says it "matches Minima's `Wallet.java` exactly" for
  seed derivation, per-address TreeKey, address public keys and signing.
- `tx-builder` functions are built on the same serialization and witness rules.

**Risk:** High. These are the files most likely to be considered derivative
because they reproduce wire formats and wallet derivation behavior from the Java
source.

---

### F4 — WOTS is BouncyCastle-derived (Medium/High confidence)

**Packages:** `core`, `core-wasm`

The WOTS implementation is not only Minima-derived; it is explicitly
BouncyCastle-compatible:

- `packages/core/src/wots.ts`
- `packages/core-wasm/src/wots.rs`

The code names:

- `org.bouncycastle.pqc.crypto.gmss.util.WinternitzOTSignature`
- `WinternitzOTSVerify`
- `GMSSRandom`

It also describes BouncyCastle's stateful PRNG and byte-addition algorithm.

**Risk:** Medium/High. Bouncy Castle uses a permissive MIT-style license, but it
has its own notice requirements. The repository has no Bouncy Castle notice.
This is a separate attribution item from Minima.

---

### F5 — QVAC type declarations are vendored from an Apache-2.0 package (Medium)

**File:** `packages/qvac/src/vendor/qvac-sdk.d.ts`

The file says it is a faithful reconstruction of `@qvac/sdk@0.19.0` declarations.
`@qvac/sdk` and `@qvac/inference` are Apache-2.0.

**Risk:** Medium. Type declarations can be copyrightable. The file has no
Apache-2.0 header or notice. If the vendored surface is distributed, include the
QVAC attribution in `NOTICE` or replace the vendored declarations with a
generated/reference-only surface.

---

### F6 — BIP39 word list (Low)

**Files:** `packages/core/src/bip39.ts`, `packages/core-wasm/src/bip39.rs`

The word list is sourced from `bitcoin/bips` (`bip-0039/english.txt`, MIT). The
source is documented in the TypeScript file.

**Risk:** Low. The list is likely not copyrightable as a bare word list, but keep
the source attribution in the notice file for completeness.

---

### F7 — Google protobuf generated code (Low, header present)

**File:** `packages/agent-policy/src/generated/google/protobuf/struct.ts`

The file retains the Google BSD-3-Clause header. The package is MIT, which is
compatible for distribution, but the third-party notice should be consolidated.

**Risk:** Low. No code change required beyond a third-party notice.

---

### F8 — Contributor Covenant (Low, attribution present)

**File:** `CODE_OF_CONDUCT.md`

The document states it is adapted from Contributor Covenant 2.1 and links to the
source.

**Risk:** Low. Attribution is present.

---

### F9 — No consolidated NOTICE file (High process gap)

There is no root `NOTICE`, `THIRD_PARTY_NOTICES.md` or equivalent. The repository
has:

- MIT `LICENSE` and per-package MIT licenses.
- A Google BSD header inside one generated file.
- No Minima attribution.
- No Bouncy Castle notice.
- No QVAC notice.
- No consolidated third-party notice.

**Risk:** High process gap. Even if the project remains MIT, the Apache-2.0 and
Bouncy Castle obligations still need a notice path.

---

### F10 — Package metadata is uniformly MIT (High process gap)

All publishable packages declare `"license": "MIT"`, and every package `LICENSE`
file is MIT. This is consistent internally but inconsistent with the provenance
findings above.

If the project moves to Apache-2.0, the change must be atomic across:

- root `LICENSE`
- all publishable `packages/*/LICENSE`
- all `packages/*/package.json`
- `README.md`
- `CONTRIBUTING.md`
- `SDK_MANIFEST.json`
- SBOM metadata
- npm release notes / provenance
- docs site license page, if any

---

## 4. What appears original

The following areas have no Minima source-copy markers in the reviewed surface
and appear to be original Totem work, even where they implement Minima protocol
semantics:

- `omnia`, `omnia-factory`, `omnia-router`, `omnia-pool`, `omnia-splice`,
  `omnia-vtxo`, `omnia-host` (Omnia protocols and orchestration)
- `statechain`, `se-server`
- `proof`, `proofgraph`, `proof-integritas`, `location-proof`, `spatial-proof`,
  `raster-proof`
- `storage` and its adapters
- `edge`, `edge-*` connectors, `industrial-action`
- `lookup-*`, `chain-provider`, `realtime`
- `identity`, `manifest`, `authority`, `agent-policy`, `decision`, `intelligence`
- `connect`, `wallet-adapter`, `stream-transport`, `pear`, `pubsub-transport`,
  `p2p-hub`
- most of `kissvm/src/templates`

This is not a legal conclusion that these packages are free of third-party
influence. It means no source-copy markers were found in this review.

---

## 5. Recommended remediation

### 5.1 License direction

**Recommended:** license new releases of the public SDK under **Apache-2.0**,
with a `NOTICE` file. This is simpler and more honest than a mixed MIT/Apache
repository, and it matches the Apache-2.0 provenance of the Minima-derived core.

Alternative: keep MIT for original packages and add Apache-2.0 notices only to
derived files. This is legally possible but operationally confusing for consumers,
SBOMs and package metadata. Given a single contributor, the whole-repository
Apache-2.0 route is cleaner.

Existing published versions remain MIT. Do not rewrite history or claim that old
releases were Apache-2.0.

### 5.2 Notice file

Add a root `NOTICE` covering at least:

- Minima / `minima-global/Minima` — Apache-2.0; identify the translated core,
  KISSVM, serialization and wallet surfaces.
- Bouncy Castle — WOTS/GMSS algorithm compatibility.
- QVAC — vendored type surface.
- Google Protocol Buffers — BSD-3-Clause generated file.
- BIP39 — English word list source.
- Contributor Covenant — Code of Conduct attribution.

If a file contains a required header, preserve it. Do not strip third-party
headers during relicensing.

### 5.3 Metadata and release work

1. Update root and package `LICENSE` files.
2. Update all 67 publishable `package.json` `license` fields.
3. Update `CONTRIBUTING.md` to Apache-2.0.
4. Update README badge and license section.
5. Update `SDK_MANIFEST.json` if it carries license metadata.
6. Add license data to SBOM generation.
7. Publish a release note that explains the license transition and that old
   releases remain MIT.
8. Add a CI check that every publishable package's `license` matches the root
   license.

### 5.4 Optional provenance headers

For the derived files, add a short header such as:

```text
Portions translated from minima-global/Minima (Apache-2.0).
See NOTICE and THIRD_PARTY_NOTICES.md.
```

This is not required by Apache-2.0 for every file, but it makes the provenance
auditable and prevents a future maintainer from accidentally describing the code
as clean-room.

---

## 6. Open questions for counsel

1. Is the TypeScript/Rust translation a derivative work of Minima's Java code?
   The source-alignment comments strongly suggest yes.
2. What Bouncy Castle notice text is required for the WOTS translation?
3. Are the QVAC type declarations copyrightable, and what attribution is required?
4. Does the project prefer a single Apache-2.0 license or a mixed MIT/Apache
   layout?
5. Are there any patent or trademark issues in describing the SDK as
   Minima-compatible without implying endorsement?

---

## 7. Bottom line

The project should not claim clean-room provenance. The core cryptographic,
KISSVM, serialization and wallet surfaces are closely translated from
Apache-2.0 Minima source, with Bouncy Castle algorithm compatibility and a
vendored Apache-2.0 QVAC type surface.

The current MIT-only packaging is therefore likely incomplete. The recommended
next step is an Apache-2.0 relicensing of new public releases, a consolidated
`NOTICE`, and a metadata/SBOM migration. Because the repository has a single
contributor, the contributor-consent problem is manageable; the remaining work is
provenance disclosure and consistent packaging.
