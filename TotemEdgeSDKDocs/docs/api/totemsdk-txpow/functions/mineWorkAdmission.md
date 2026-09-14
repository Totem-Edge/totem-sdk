[**@totemsdk/txpow**](../index.md)

***

[@totemsdk/txpow](../index.md) / mineWorkAdmission

# Function: mineWorkAdmission()

> **mineWorkAdmission**(`action`, `challenge`, `templateProvider`, `options?`): `Promise`\<[`MachineWorkAdmissionProof`](../interfaces/MachineWorkAdmissionProof.md)\>

Mine a Machine Work Admission proof.

The admission target is derived from `challenge.target` — the challenge is
the single authoritative source. The miner searches the nonce space of a
real Minima block candidate (from the injected template provider) whose
customHash commits to the action.

## Parameters

### action

[`MachineWorkAction`](../interfaces/MachineWorkAction.md)

The application action.

### challenge

[`WorkChallenge`](../interfaces/WorkChallenge.md)

The receiver-issued challenge (target is authoritative).

### templateProvider

[`MinimaWorkTemplateProvider`](../interfaces/MinimaWorkTemplateProvider.md)

Injected provider for the current Minima template.

### options?

[`MineWorkAdmissionOptions`](../interfaces/MineWorkAdmissionOptions.md)

Mining options.

## Returns

`Promise`\<[`MachineWorkAdmissionProof`](../interfaces/MachineWorkAdmissionProof.md)\>
