# Stale gap-claim audit (October 2026)

Status: **Audit + documentation corrections.**
Snapshot: 2026-10-20, `main` at `95d689c7`.
Trigger: an investor-facing sentence claimed that “the project’s own October
conformance RFC still identifies gaps in independently recoverable exits,
executable settlement proofs and capital reconciliation.”

That exact sentence is **not in this repository**. It maps to the October
conformance material, principally RFC-048 §3/§8/§12, RFC-039 and RFC-050. Those
documents were written before the S4–S10 work, the exit-clock fix, the
factory/VTXO exit work, and the custody/signer-port work. Several gap statements
are now resolved but were never marked, so a reader can still cite them as
current.

This audit separates:

- **RESOLVED** — the claim was true when written; code/tests now close it.
- **PARTIAL** — the core primitive landed, but a named residual remains.
- **OPEN** — still true; do not mark fixed.
- **HISTORICAL** — the doc is a past audit/plan; add a banner rather than
  rewriting the findings.

---

## 1. The three claims in the trigger sentence

| Claim | Current status | Evidence |
|---|---|---|
| **Independently recoverable exits** | **RESOLVED at SDK/VM level**; L4 live-chain remains. | RFC-039 landed the structural fixes for `omnia`, `omnia-factory`, `omnia-vtxo`; per-share VTXO exit (`omnia-vtxo/src/exit-tx.ts`), factory distribution escape (`factoryDistributionOutputs`/`buildFactoryDistributionScript`), and exit-clock pinning (`docs/audits/omnia-vtxo-exit-clock-2026-10.md`). `custody-exec` and `custody-exec-vm` exercise honest/malicious exits in TS and Rust/WASM. |
| **Executable settlement proofs** | **RESOLVED at SDK/VM level**; live multi-node remains. | P-EXIT first shape implemented (`kissvm/src/templates/exercise.ts`, `scripts/exercise-exec-vm.mjs`); factory settlement build/sign/assemble (`omnia-factory/src/settlement.ts`); server settlement verification landed (RFC-036 status Landed); S4/S5/S8 green. |
| **Capital reconciliation** | **RESOLVED for draft-as-settlement**; residual label. | `omnia-pool/src/withdraw.ts` now requires `settlement` before consuming the receipt or decrementing LP capital; draft-only returns unchanged position/registry. Tests cover the no-settlement path. Residual: the settled status string is still `'settled-externally'`, which RFC-048 A3 said to stop using. |

The honest current wording is: **SDK/VM conformance is implemented and tested;
live L4 isolated-node/multi-host conformance remains the next gate.**

---

## 2. High-priority stale claims corrected

| Document | Stale claim | Correction applied |
|---|---|---|
| `docs/rfc/RFC-039-CUSTODY-CONFORMANCE.md` §1 | “shipped several fund-holding scripts with no unilateral exit” | Added a post-landing note: §1 is the historical pre-fix state; the three structural fixes and the gate landed. |
| `docs/rfc/RFC-048-OMNIA-PRIMITIVE-COMPLETENESS.md` §3.3 / A3 | `executePoolPayout` may settle against a draft | Added **FIXED** note: settlement evidence is required; draft-only leaves state unchanged. Residual: rename `settled-externally`. |
| RFC-048 §12.4 | “On-chain single-party exit against a committed balance set is blocked” | Added **RESOLVED BY DESIGN**: pre-signed all-party distribution implements the required single-party escape; literal on-chain root recomputation remains impossible. |
| RFC-048 §12.8 | Party count/port code gap | Added **FIXED**: share/factory bases are 128, max 102, `check-state-ports` gate. |
| RFC-048 §12.10 | Rust/WASM 3-arg `PROOF` parity gap | Added **FIXED**: canonical 5-arg MMR `PROOF`; parity gates. |
| `docs/rfc/RFC-049-MASH-OMNIA-EEFI-PROGRAMMABLE-CAPITAL.md` §5.3 | “Code gap (tracked)” | Marked **FIXED** (already described the relocation and gate). |
| `docs/rfc/RFC-050-EEFI-PRODUCT-ARCHITECTURE.md` §3 | “The load-bearing gap” | Renamed to “first shape implemented”; added status note that product economics/oracle runtime/L4 remain open. |
| RFC-050 §4 table | P-EXIT row “Partial / new” | Updated to “Implemented (first shape); product economics open”. |
| `docs/rfc/RFC-058-CUSTODY-MODES-AND-DISCLOSURE-GATE.md` §5.0 | Pre-implementation table lists SignerPort, VTXO/pool host methods and extension gate as missing | Added a post-implementation note: SignerPort, custody mode, VTXO/pool host methods and the extension disclosure gate landed; KMS/HSM/MPC, live E2E and deployment policy/CI remain open. |

## 3. Other docs reviewed — no stale investor-facing claim found

These were checked and left unchanged, or already carry an accurate status:

- **RFC-005** — gap-fix log; rows are already `Resolved`/`Intentional`/`Deferred`.
- **RFC-007 / RFC-007-A** — pre-release storage plan; outstanding items are
  current, not stale.
- **RFC-035** — B5 (extension/PWA host wiring) is still pending; current.
- **RFC-036** — Status `Landed (S0–S3)`; remaining “gap” wording is about
  consumers that ignore settlement, not an unimplemented SDK gap.
- **RFC-038** — accurately says V2/V3 exits landed and funding-proof/pre-signed
  exit remain pending.
- **RFC-047** — reuse/migration hazards are design constraints, not gap claims.
- **RFC-052** — blocked/fallback language is current by design (multi-IO not
  landed).
- **RFC-059 / RFC-060** — explicitly clean-break/prerelease.
- **RFC-061 / RFC-062** — current custody/pairing boundaries; no stale claim
  found.
- **`docs/OMNIA_TEST_RESULTS.md`** — S6/S7/S10 pass; S7 live E2E, S8 3-host and
  S11 are explicitly pending.
- **`docs/audits/sdk-audit-remediation-2026-09.md`** — already carries a
  `FIXED`/`OPEN` ledger (`FIXED 46`, `OPEN 0`).
- **`docs/audits/omnia-vtxo-exit-clock-2026-10.md`** — already says “fix
  applied” and names the remaining L4/root-epoch work.

## 4. Historical docs that need a banner, not a rewrite

These contain findings that were accurate at their snapshot but have since been
partly remediated. They now carry a “historical snapshot” banner pointing to the
current status source:

- `docs/audits/kissvm-template-audit-2026-09.md` → RFC-016/018/020 and
  `sdk-audit-remediation-2026-09.md`.
- `docs/audits/kissvm-recursive-mast-adversarial-2026-09.md` → RFC-018/020.
- `docs/audits/wallet-connect-parity-2026-09.md` → RFC-014 (47/47 served,
  `KNOWN_GAPS` empty) and `audit-wallet-connect-parity.mjs`.
- `docs/dead-code-inventory.md` → many stubs were implemented in RFC-004/008/038
  /058; verify before treating an item as open.
- `docs/remediation-plan.md` → historical plan; current status is in the audit
  remediation log and RFCs.

## 5. Do not mark these fixed

These are current residuals; changing them without new evidence would be
misrepresentation:

- **RFC-038**: VTXO funding-proof cryptographic verification and pre-signed exit
  attached at funding are still listed pending. `checkPoolFunding` only verifies
  proof when a `verifyProof` callback is supplied; `fundingProof` remains
  `unknown`.
- **RFC-048 / RFC-050**: live L4 isolated-node conformance, full pooled-capital
  gate (RFC-050 §7.1), dynamic transferred-owner recovery, and broader root/epoch
  state-continuity review.
- **RFC-058**: KMS/HSM/MPC + policy engine, live E2E chain execution, deployment
  custody policy/CI, full durable audit/reconciliation.
- **RFC-035 B5**: extension/PWA host wiring and approval UI.
- **Omnia test plan**: S7 live 2-host E2E, S8 3-host/cross-token E2E, and S11
  Axia watchtower.
- **`docs/audits/omnia-vtxo-exit-clock-2026-10.md`**: L4 isolated-node run and
  broader state-continuity review.

## 6. Wording standard

For investor-facing summaries, prefer:

> “The SDK and VM implement independently recoverable exits, executable
> settlement covenants, and settlement-evidence-gated capital reconciliation,
> with conformance tests. Live isolated-node/multi-host L4 conformance remains
> the next gate.”

Do not say “no gaps”, “fully audited”, or “production-final” while §4 items
remain open.

## 7. Follow-up

1. Re-run this audit after the next L4/S11 milestone and remove resolved rows.
2. Add the stale-claim banner convention to `docs/README.md`:
   historical audits must state their snapshot commit and current status source.
3. Keep `@deprecated`/compatibility cleanup separate from this doc; it is covered
   by `docs/audits/prelaunch-compatibility-audit-2026-10.md`.
