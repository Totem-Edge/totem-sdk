# Fuzz and Property Targets

**Status:** Phase 1 B3 — complete for the current Tier 0/1 surface
**Owner:** Totem SDK maintainers
**Related:** [threat-model.md](threat-model.md), [crypto-policy.md](crypto-policy.md),
[RFC-063](../rfc/RFC-063-PRODUCTION-READINESS-AND-MATURITY-PROMOTION.md)

These targets are deterministic: each test uses a fixed seed and a bounded
iteration count, so a failure reproduces in CI without a separate fuzz runner.
They run inside the normal package test suites.

---

## Landed targets

| Target | Test | Invariant |
|---|---|---|
| Lookup framing | `packages/lookup-protocol/src/__tests__/framing-fuzz.test.ts` | Encode→decode preserves a generated message; arbitrary/truncated bytes return `FramingError` or a structurally valid message; non-object JSON is rejected; oversized lengths are rejected before body allocation |
| Omnia framing | `packages/omnia/src/__tests__/framing-fuzz.test.ts` | Encode→decode preserves bigint/`Uint8Array` payloads; every split point reassembles; arbitrary bytes return `FramingError` or a structurally valid message; non-message JSON is rejected |
| Manifest encoding | `packages/manifest/src/__tests__/encoding-fuzz.test.ts` | Encode→decode preserves the signed manifest; arbitrary bytes return a controlled `Error`, never `TypeError`/`RangeError`; null/primitive JSON is rejected; invalid signature hex is rejected before encoding |
| KISSVM parser/evaluator | `packages/kissvm/src/__tests__/parser-eval-fuzz.test.ts` | Random source parses or throws a controlled error; generated scripts return an EvalResult or `KissvmLimitError`; no host exception escapes |
| Proof verification | `packages/proof/src/__tests__/verify-fuzz.test.ts` | Semantic mutations of a valid WOTS proof are rejected; malformed values return `{valid:false}` without throwing |
| Lookup ticket sequences | `packages/lookup-node/src/__tests__/ticket-fuzz.test.ts` | Random seq/budget/revoke sequences match the ticket model across SQLite reopen |
| Storage CAS/reopen | `packages/storage/src/__tests__/cas-fuzz.test.ts` | Contending FileStore instances lose no acknowledged update; revisions stay unique and state survives reopen |
| Omnia channel transitions | `packages/omnia/src/__tests__/channel-transition-fuzz.test.ts` | Monotonic/sequence/conservation validation and watermark replay/rollback boundaries match the model |
| Industrial policy boundaries | `packages/industrial-action/src/__tests__/condition-fuzz.test.ts` | Numeric/in/not_in conditions match the model; missing fields, unknown operators and throwing evaluators fail closed |

Run:

```bash
pnpm --filter @totemsdk/lookup-protocol test
pnpm --filter @totemsdk/omnia test
pnpm --filter @totemsdk/manifest test
pnpm --filter @totemsdk/kissvm test
pnpm --filter @totemsdk/proof test
pnpm --filter @totemsdk/lookup-node test
pnpm --filter @totemsdk/storage test
pnpm --filter @totemsdk/industrial-action test
```

The test files document their fixed seeds. Change a seed only when adding a new
case; a seed change is not a substitute for fixing a failure.

---

## Invariants enforced by the current targets

1. Framing never returns a non-object as a protocol message.
2. A declared frame length larger than the protocol maximum is rejected before
   reading the body.
3. A truncated frame is rejected, not partially parsed.
4. JSON parse failures are converted to the protocol's framing error.
5. `bigint` and `Uint8Array` sentinels round-trip without silent coercion.
6. Manifest decoding never dereferences a null/primitive JSON payload.
7. Invalid hex is rejected before signature bytes are emitted.
8. Channel transitions require a strictly higher sequence and exact balance conservation.
9. The signing watermark rejects rollback and a different commitment at the same sequence.
10. Industrial policy evaluation fails closed for missing fields, unknown operators and a throwing evaluator.

---

## Future expansion

B3 is complete for the current Tier 0/1 surface. Add targets when a new adapter,
transport or policy operator enters the supported path. Candidate future targets:

- SQLite/IndexedDB CAS under multi-process contention
- larger multi-hop route graphs and HTLC timeout/refund matrices
- industrial profile/HIL envelope composition
- fuzz targets for new wire versions

Do not mark a new transport or adapter as supported until it has a deterministic
target or equivalent conformance evidence.

---

## Failure handling
