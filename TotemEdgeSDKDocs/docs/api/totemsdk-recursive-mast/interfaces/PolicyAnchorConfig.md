[**@totemsdk/recursive-mast**](../index.md)

***

[@totemsdk/recursive-mast](../index.md) / PolicyAnchorConfig

# Interface: PolicyAnchorConfig

Policy Anchor Coin — a stable on-chain UTXO whose locking script commits to
a set of policy roots that can rotate through state updates.

The anchor has explicit branches:
  1. Normal action — MAST the selected action root
  2. Root rotation — MAST the root-rotation authority
  3. Epoch advancement — MAST the epoch-advancement authority
  4. Recovery — MAST the recovery root
  5. Emergency — MAST the emergency root

Every successful branch must enforce the complete successor anchor:
  - Same subject identity
  - Same token and amount (unless explicitly permitted)
  - Expected anchor script/address
  - Exact next epoch
  - Authorized root changes only
  - Unchanged roots preserved
  - Expected manifest commitment
  - Exactly one valid successor output
  - No duplicate anchor outputs

State port assignments:
  State 0  = subject ID
  State 10 = current regulator policy root
  State 11 = current owner policy root
  State 12 = current service-provider root
  State 13 = current firmware-approval root
  State 14 = policy epoch
  State 15 = policy-manifest commitment
  State 16 = recovery root
  State 17 = emergency root
  State 18 = action root (set by the spender to select which action to execute)

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
