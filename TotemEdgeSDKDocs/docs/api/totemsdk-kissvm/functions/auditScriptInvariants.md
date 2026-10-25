[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / auditScriptInvariants

# Function: auditScriptInvariants()

> **auditScriptInvariants**(`input`): [`InvariantViolation`](../interfaces/InvariantViolation.md)[]

Static, deterministic detector of the RFC-016 invariants. Heuristic: it flags
the confirmed anti-patterns (authority from mutable state, missing output
binding, unmatched authorizing branches). It is the gate for the adversarial
harness, not a substitute for dynamic evaluation.

## Parameters

### input

[`InvariantAuditInput`](../interfaces/InvariantAuditInput.md)

## Returns

[`InvariantViolation`](../interfaces/InvariantViolation.md)[]
