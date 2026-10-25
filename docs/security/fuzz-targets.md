# Fuzz and Property Targets

**Status:** Phase 1 B3 — initial wire/encoding targets landed
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

Run:

```bash
pnpm --filter @totemsdk/lookup-protocol test
pnpm --filter @totemsdk/omnia test
pnpm --filter @totemsdk/manifest test
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

---

## Next targets

These are required to close B3, but are not implemented yet:

| Target | Package(s) | Invariant |
|---|---|---|
| KISSVM lexer/parser | `kissvm` | Arbitrary token streams either parse or throw `KissvmParseError`; no `TypeError`/`RangeError` escapes |
| KISSVM evaluator | `kissvm` | Bounded execution, no uncaught host exception, step/op limits enforced |
| Tx builder serialization | `tx-builder`, `core` | Valid object/hex round-trips; malformed bytes fail closed; no silent truncation |
| Proof/manifest verification | `proof`, `manifest` | Mutated signatures/keys/digests are rejected; no verifier throws an uncontrolled error |
| Omnia channel transitions | `omnia`, `omnia-host` | Generated valid/invalid sequence transitions preserve conservation and reject replay/rollback |
| Storage adapters | `storage` | Generated concurrent CAS/reopen sequences do not lose acknowledged updates |
| Lookup session tickets | `lookup-node` | Generated ticket/seq/reopen sequences preserve budget and replay rejection |
| Industrial actions | `industrial-action` | Generated policy/envelope boundaries fail closed |

Do not mark B3 complete until these targets exist and run in CI.

---

## Failure handling

A fuzz/property failure is an SDK defect unless the harness itself is invalid.
Fix the parser/state machine or add a documented invariant; do not reduce the
iteration count or catch a broader error class to make the test pass.
