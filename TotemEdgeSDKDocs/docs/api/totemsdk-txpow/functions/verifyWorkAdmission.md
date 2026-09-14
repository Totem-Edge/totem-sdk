[**@totemsdk/txpow**](../index.md)

***

[@totemsdk/txpow](../index.md) / verifyWorkAdmission

# Function: verifyWorkAdmission()

> **verifyWorkAdmission**(`action`, `challenge`, `proof`, `templateProvider?`, `options?`): `Promise`\<[`WorkAdmissionVerification`](../interfaces/WorkAdmissionVerification.md)\>

Verify a Machine Work Admission proof.

The admission target is taken from the validated challenge — never from the
proof. `proof.qualifiesAsMinimaBlock`, `proof.superLevel`, and
`proof.isBlock` are treated as derived metadata and are NOT trusted; the
Super level is recomputed from the re-derived txpowId and the template's
block difficulty.

## Parameters

### action

[`MachineWorkAction`](../interfaces/MachineWorkAction.md)

The application action the proof claims to commit.

### challenge

[`WorkChallenge`](../interfaces/WorkChallenge.md)

The challenge the proof claims to satisfy.

### proof

[`MachineWorkAdmissionProof`](../interfaces/MachineWorkAdmissionProof.md)

The mined proof.

### templateProvider?

[`MinimaWorkTemplateProvider`](../interfaces/MinimaWorkTemplateProvider.md)

Optional live provider. When supplied, template
                        freshness and broadcastability are checked and
                        `broadcastable` is set. When omitted, verification
                        runs in offline mode and does NOT claim Minima
                        block contribution (`broadcastable` is undefined).

### options?

[`VerifyWorkAdmissionOptions`](../interfaces/VerifyWorkAdmissionOptions.md)

Verification options.

## Returns

`Promise`\<[`WorkAdmissionVerification`](../interfaces/WorkAdmissionVerification.md)\>
