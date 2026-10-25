[**@totemsdk/recursive-mast**](../index.md)

***

[@totemsdk/recursive-mast](../index.md) / PolicyAnchorConfig

# Interface: PolicyAnchorConfig

Policy Anchor Coin — a stable on-chain UTXO whose locking script commits to
a set of policy roots that can rotate through state updates.

The anchor is **fail-closed**: `STATE(actionRoot)` must be one of the
enabled action codes, and every MAST root executed by the anchor is bound
to a committed `PREVSTATE` root. A spender cannot supply an arbitrary root.

Enabled branches:
  0. Normal action — MAST a committed policy root selected via state
  1. Root rotation — MAST the committed owner root; exactly one root changes
  2. Epoch advancement — MAST the committed owner root; epoch advances by 1
  3. Recovery — MAST the committed recovery root (only if configured)
  4. Emergency — MAST the committed emergency root (only if configured)

Invariants enforced for every successful branch:
  - Same subject identity (`STATE(0)`)
  - Manifest commitment unchanged
  - Root ports preserved except the single port a rotation declares
  - Epoch unchanged, except the epoch-advancement branch (exact +1)
  - Successor anchor preserved at the input index (`VERIFYOUT(@INPUT …)`)

Residual limitation: KISSVM exposes no output-count primitive, so the
anchor cannot itself count duplicate anchor outputs. "Exactly one successor
output" is enforced for the input-indexed output only; duplicate-output
prevention must be enforced by the revealed action branch or the
transaction planner.

State port assignments (defaults):
  State 0  = subject ID
  State 10 = current regulator policy root
  State 11 = current owner policy root
  State 12 = current service-provider root
  State 13 = current firmware-approval root
  State 14 = policy epoch
  State 15 = policy-manifest commitment
  State 16 = recovery root
  State 17 = emergency root
  State 18 = action selector (0–4)
  State 19 = action argument (selected root, or rotation target port)

## Properties

### emergencyRoot?

> `optional` **emergencyRoot?**: `string`

***

### initialEpoch

> **initialEpoch**: `number`

***

### institutionalRoot

> **institutionalRoot**: `string`

***

### ports

> **ports**: `object`

#### actionRoot

> **actionRoot**: `number`

#### emergencyRoot

> **emergencyRoot**: `number`

#### epoch

> **epoch**: `number`

#### firmwareApprovalRoot

> **firmwareApprovalRoot**: `number`

#### manifestHash

> **manifestHash**: `number`

#### ownerRoot

> **ownerRoot**: `number`

#### recoveryRoot

> **recoveryRoot**: `number`

#### regulatorRoot

> **regulatorRoot**: `number`

#### serviceProviderRoot

> **serviceProviderRoot**: `number`

***

### recoveryRoot?

> `optional` **recoveryRoot?**: `string`

***

### subjectId

> **subjectId**: `string`

***

### subjectType

> **subjectType**: `"site"` \| `"vehicle"` \| `"machine"` \| `"device"` \| `"fleet"` \| `"building"`
