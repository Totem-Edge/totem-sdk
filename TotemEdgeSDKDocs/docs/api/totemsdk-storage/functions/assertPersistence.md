[**@totemsdk/storage**](../index.md)

***

[@totemsdk/storage](../index.md) / assertPersistence

# Function: assertPersistence()

> **assertPersistence**(`ports`, `requirement`, `label`): [`EffectivePersistence`](../interfaces/EffectivePersistence.md)

Validate supplied ports against a declared requirement at construction.
Throws `StorageError('unavailable')` on any capability/policy/config mismatch.
Never downgrades silently.

## Parameters

### ports

[`PersistencePorts`](../interfaces/PersistencePorts.md)

### requirement

[`PersistenceRequirement`](../interfaces/PersistenceRequirement.md)

### label

`string`

## Returns

[`EffectivePersistence`](../interfaces/EffectivePersistence.md)
