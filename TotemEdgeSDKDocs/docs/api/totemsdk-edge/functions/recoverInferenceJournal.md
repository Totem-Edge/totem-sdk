[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / recoverInferenceJournal

# Function: recoverInferenceJournal()

> **recoverInferenceJournal**(`journal`): `Promise`\<[`InferenceRecoveryReport`](../interfaces/InferenceRecoveryReport.md)\>

The accounting-recovery view over an inference journal.

Walks the whole journal (strict: any corruption — a hole, a duplicate
start/finish for one requestId, a `finished` with no matching `started` —
surfaces rather than being treated as absence, matching RFC-007 §4.2).
Returns:

- `interrupted`: `started` without `finished` → **outcome-unknown**.
  The host must hold budget for these and must never re-run the call or
  issue a receipt (RFC-007 §3.5).
- `completed`: definitively completed `finished` events, available for
  reconciliation against the owning domain authority.

Performs zero provider interaction.

## Parameters

### journal

`Journal`\<[`InferenceAuditEvent`](../type-aliases/InferenceAuditEvent.md)\>

## Returns

`Promise`\<[`InferenceRecoveryReport`](../interfaces/InferenceRecoveryReport.md)\>
