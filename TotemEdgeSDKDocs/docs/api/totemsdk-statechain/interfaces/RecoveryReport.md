[**@totemsdk/statechain**](../index.md)

***

[@totemsdk/statechain](../index.md) / RecoveryReport

# Interface: RecoveryReport

## Properties

### hasReclaimTx

> `readonly` **hasReclaimTx**: `boolean`

True when a persisted `reclaimTx` exists for the chain.

***

### ownerRecoveryMaterialPresent

> `readonly` **ownerRecoveryMaterialPresent**: `boolean`

True when the current-owner fields needed to spend the reclaim TX exist.

***

### reason?

> `readonly` `optional` **reason?**: `string`

Reason when `verifies` is false.

***

### recoverableWithoutSE

> `readonly` **recoverableWithoutSE**: `boolean`

True when the chain can be recovered without SE cooperation (strict).

***

### verifies

> `readonly` **verifies**: `boolean`

True when the stored chain verifies (`verifyStateChain` passes).
