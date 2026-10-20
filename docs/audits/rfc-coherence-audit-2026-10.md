# RFC coherence audit — incomplete and unstarted RFCs (October 2026)

Status: **Audit + status corrections.**
Snapshot: 2026-10-20, `main` at `4a011934`.
Scope: every RFC whose status is Draft, In progress, partial, authorised-but-not-started, or
`Phase N` incomplete.

This audit checks for:

- **status drift** — the header does not reflect what is implemented;
- **broken dependencies** — a wrong RFC number or a dependency on an unstarted RFC;
- **sequencing conflicts** — “next” work that is blocked by an unstarted prerequisite;
- **internal contradictions** — the same RFC proposes two different package/ownership shapes;
- **cross-RFC contradictions** — two RFCs disagree about whether something is implemented;
- **overlap** — several RFCs claim the same surface without a clear owner.

It does not re-audit the design decisions; it checks whether the documents are honest and
internally consistent.

---

## 1. Incomplete / unstarted inventory

| RFC | Status after this pass | Reality |
|---|---|---|
| RFC-001 | Historical — extension rollout implemented | Rollout code exists; superseded by RFC-014/058 for current direction |
| RFC-007 | In progress | Phases 0–3 landed; 3a/4 partial; 5 outstanding; 6 deferred |
| RFC-008 | Draft — Phase 1 | Go SE signing routes landed via RFC-033; residual OQ7/non-WOTS |
| RFC-009 | Draft — Phases 0–3 | Rust verifier + Go SE now exist; residual parity audit only |
| RFC-014-A | Draft — A0–A2 | A3 blocked on RFC-015 (not started) |
| RFC-018 | Landed — remediation | P0–P2 landed; acceptance gate green |
| RFC-019 | Draft — P0–P2 | Residual: post-authorization negotiation acceptance |
| RFC-020 | Landed — remediation | P0–P2 landed; acceptance gate green |
| RFC-021/021-A | Draft — design | Not implemented |
| RFC-022 | Draft — design | Not implemented (`preparedCommandHash` absent) |
| RFC-023 | Draft — design | Not implemented (no physical effect model) |
| RFC-024–027 | Draft — design | Not implemented (OCPP/MAVLink/ROS2/Autoware profiles) |
| RFC-028 | Landed | V1/V2/V3 implemented in `decision` |
| RFC-029 | Draft — design | Not implemented (`byType` absent) |
| RFC-030 | Draft — design | Shortlisting deferred by RFC-012 |
| RFC-031 | Draft — P4 substantially landed | P5 (`/legacy` removal) remains |
| RFC-032 / 032-A | Landed (TypeScript) + Go lookup-client tickets | Go lookup-client cache/seq/reopen landed; Go node ticket store remains |
| RFC-033 | Landed | Go FFI + interop green |
| RFC-034 | Phase A landed | Phase B tracked in RFC-035 |
| RFC-035 | In progress | Onion codec, forwarder hook, capability flips remain |
| RFC-038 | In progress | V4 next; funding-proof/pre-signed exit remain |
| RFC-047 | Phase-0 research only | No `@totemsdk/experience` package |
| RFC-048 | Draft — partial implementation | See Resolution status; L4/pooled-capital residuals |
| RFC-049 | Draft — proposed | MASH/Eefi architecture; no SDK implementation |
| RFC-050 | Draft — P-EXIT first shape | Product economics/oracle/L4 remain |
| RFC-051 | Draft — proposed | Not implemented |
| RFC-052 | Draft — proposed | No multi-IO implementation |
| RFC-053 | Landed | `@totemsdk/eefi@0.1.0` published |
| RFC-054 | Draft — **not started** | No spot-exchange protocol |
| RFC-055 | Phase 1 landed | `omnia-router@0.4.0`; Phase 2+ not authorised |
| RFC-056 | P1 landed | `@totemsdk/entity@0.1.0` published |
| RFC-057 | Draft — **not started** | Phase 0 authorised only |
| RFC-058 | Draft — partial | SignerPort/host methods/gate landed; KMS/live E2E remain |
| RFC-059 | Draft — **not started** (concurrent file) | `@totemsdk/eefi-credit` absent |
| RFC-060 | Draft — **not started** (concurrent file) | `@totemsdk/points` absent |
| RFC-061 | Draft — P0 follow-on (concurrent file) | No implementation found |
| RFC-062 | Draft — P1 (concurrent file) | No pairing implementation found |

---

## 2. Findings

### 2.1 Broken / wrong dependencies

- **RFC-056** declared a dependency on **“RFC-020 (Identity and Claims)”**. RFC-020 in this
  repository is *Multi-Package Adversarial Hardening*. Identity/claims is the
  `@totemsdk/identity` package surface, not RFC-020. The dependency was corrected to
  `@totemsdk/identity` + RFC-037; RFC-051/RFC-053 were removed from the dependency list
  because the entity package does not import Eefi or AI-proposed facts.
- **RFC-053** depended on RFC-051 (AI-Proposed Committed Facts), which the implemented
  `@totemsdk/eefi` package does not use. Removed.

### 2.2 Status drift (corrected where tracked)

- **RFC-053** — `@totemsdk/eefi@0.1.0` is implemented, tested and published; status changed
  from “implementation authorised” to **Landed**.
- **RFC-055** — `@totemsdk/omnia-router@0.4.0` implements the bounded routing engine; status
  changed from “Phase 1 authorised” to **Phase 1 landed**.
- **RFC-056** — `@totemsdk/entity@0.1.0` is implemented, tested and published; status changed
  from “P1 authorises” to **P1 landed**.
- **RFC-028** — decision output correctness (`distributionTolerance`, `expectedScore`,
  `minOperationProbability`/`minTargetProbability`) is implemented as part of the RFC-012
  post-landing pass; status changed from “design specification” to **Landed**.
- **RFC-018/RFC-020** — P0–P2 landed and the acceptance gate is green; status changed from
  “Draft” to **Landed (remediation; open questions only)**.
- **RFC-008/RFC-009** — the “remaining Go parity / non-TS mirrors” claims predate RFC-033;
  Go SE signing routes, Go WOTS FFI and the Rust tree-signature verifier now exist. Status
  now names the residual as an audit, not a missing implementation.
- **RFC-001** — the extension rollout implementation exists; marked **Historical**, with
  RFC-014/058 as the current direction.
- **RFC-057 / RFC-054** — “authorised” now explicitly says **not started** (authorisation is
  not implementation).
- **RFC-059 / RFC-060** — status says Phase 1 authorised but no package exists. These are
  concurrent/untracked files and were **not edited**; they must add “not started” before
  investor circulation.

### 2.3 Sequencing conflicts

- **RFC-014-A A3 ↔ RFC-015.** A3 (“Axia mirror re-publish”) was labelled “next” while
  RFC-015 is “not started.” A3 is now marked **blocked on RFC-015**. Either start RFC-015
  or move A3 behind it.
- **RFC-035 / RFC-038** are correctly in progress; RFC-034 Phase B is correctly tracked in
  RFC-035.
- **RFC-031 P5** is the only remaining phase; it is not scheduled in RFC-057/048.

### 2.4 Internal contradictions

- **RFC-059 (concurrent, not edited).** It says opportunity discovery is folded into
  `@totemsdk/manifest` with **no new package** (§2.5), then later says “The `opportunity`
  package defines adapters…” (§7.2). It also names `@totemsdk/eefi-credit`, which does not
  exist. Resolve to one shape: either a new `@totemsdk/eefi-credit` package plus a
  `manifest`-owned opportunity model, or no new packages. Current status must say **not
  started**.
- **RFC-060 (concurrent, not edited).** Phase 1 is authorised but `@totemsdk/points` is not
  in the manifest and no implementation exists. Say **not started**.
- **RFC-061/RFC-062 (concurrent, not edited).** P0/P1 labels imply active work; no pairing
  or enforcement code was found. Clarify **not started** if that is the intent.

### 2.5 Cross-RFC contradictions

- **RFC-049 §8** still presents RFC-048’s “Partial” statuses for P-EXIT/settlement while
  RFC-050 §3 now says the P-EXIT first shape is implemented. Added a status note to RFC-049;
  the table remains the historical reference-revision view.
- **RFC-032/032-A** said Go mirrors were not updated. The Go lookup **node** has RFC-032 auth
  interop, the Go **SE** has leased identity, and the Go **lookup-client** now implements
  `SESSION_OPEN`/ticket cache/`seq`/reopen. The correct wording is “Go node/SE/client auth
  landed; Go node ticket store remains,” not a blanket “Go not updated.”
- **RFC-008** said Go signing routes return HTTP 501; the Go SE server now implements
  identity/signing routes. The status was corrected; the old line remains as history.

### 2.6 Overlap map (clear ownership needed)

| Cluster | RFCs | Owner / overlap risk |
|---|---|---|
| Eefi | RFC-048, 049, 050, 053, 054, 059, 060 | RFC-053 owns generic contracts; RFC-050 owns product boundary; RFC-054 spot exchange; RFC-059 credit; RFC-060 points. RFC-059 currently invents package names (`eefi-credit`, `opportunity`) without a manifest entry. Need one ownership matrix before implementation. |
| Custody | RFC-039, 058, 061, 062 | RFC-039 package gate; RFC-058 custody modes/disclosure; RFC-061 enforcement boundaries; RFC-062 node pairing. All are Draft/partial; make dependencies explicit (061/062 depend on 058 P0). |
| Storage | RFC-007, 007-A, 047, 057 | RFC-007/007-A own local persistence; RFC-047 evidence digests; RFC-057 replication (not started). No conflict, but RFC-057’s new packages must not be added to `storage`. |
| Routing | RFC-048, 055 | RFC-055 owns router; RFC-048 owns completeness. RFC-055 Phase 1 landed; no conflict. |
| Security remediation | RFC-016, 018, 019, 020 | RFC-016/018/020 landed; RFC-019 has one residual (post-authorization negotiation acceptance). Keep that residual explicit. |

### 2.7 Authorised ≠ started

The following RFCs say “implementation authorised” but have no package or code. Their status
must not be read as delivery:

- RFC-054 (spot exchange) — **not started** (status updated).
- RFC-057 (replication Phase 0) — **not started** (status updated).
- RFC-059 (credit domain) — not started (concurrent file; needs status update).
- RFC-060 (points) — not started (concurrent file; needs status update).
- RFC-061/062 (custody boundaries/pairing) — not started (concurrent files; need confirmation).

---

## 3. Status corrections applied in this pass

| File | Change |
|---|---|
| `RFC-001-SDK-UPGRADE.md` | Draft → Historical; rollout implemented, RFC-014/058 current |
| `RFC-008-FEDERATED-STATECHAIN.md` | Remaining “Go parity” → OQ7/residual route parity; the stale “routes return 501” line corrected |
| `RFC-009-KISSVM-SIGNATURE-FIDELITY.md` | Remaining mirrors → residual parity audit; Rust/Go flat-model body line corrected |
| `RFC-014-AMENDMENT-A-…` | A3 marked blocked on RFC-015 |
| `RFC-018-…` | Draft → Landed (remediation; open questions only) |
| `RFC-019-…` | Draft + residual noted (post-auth negotiation acceptance) |
| `RFC-020-…` | Draft → Landed (remediation; open questions only) |
| `RFC-028-…` | Draft → Landed (V1/V2/V3) |
| `RFC-032-…` / `RFC-032-AMENDMENT-A-…` | Corrected Go wording: WOTS/auth + Go lookup-client tickets landed; Go node ticket store remains |
| `RFC-049-…` | Added status note over the RFC-048 reference table |
| `RFC-053-…` | Draft/authorised → Landed; removed RFC-051 dependency |
| `RFC-054-…` | Added **not started** |
| `RFC-055-…` | Phase 1 authorised → Phase 1 landed |
| `RFC-056-…` | P1 authorises → P1 landed; fixed wrong RFC-020 dependency |
| `RFC-057-…` | Added **not started** |

---

## 4. Still requires a decision

1. **RFC-059 package shape.** Decide whether `@totemsdk/eefi-credit` and an
   `opportunity` package exist, or whether opportunity stays inside `@totemsdk/manifest`.
   Fix the internal contradiction before implementation.
2. **RFC-061/062 status.** Confirm whether they are proposed/not started or active; their
   P0/P1 labels currently imply delivery.
3. **RFC-014-A A3.** Start RFC-015 or explicitly defer A3.
4. **RFC-019 residual.** Decide whether post-authorization negotiation acceptance is in scope;
   if not, mark it a follow-up.
5. **RFC-032 Go node tickets.** The Go lookup-client cache/seq/reopen is implemented; decide
   whether Go node ticket minting is required for a full Go mirror.
6. **RFC-035/038/031 P5.** These are the only genuinely active residuals; keep them visible
   in the roadmap rather than in Draft-status limbo.

---

## 5. Wording standard

For incomplete RFCs, use one of:

- **Landed** — implementation + tests in `main`.
- **In progress — <landed phases>; remaining: <named work>.**
- **Authorised — not started.**
- **Proposed — design only.**

Avoid “Draft — implementation authorised” without saying whether work has started; readers
and investors will read it as delivered.
