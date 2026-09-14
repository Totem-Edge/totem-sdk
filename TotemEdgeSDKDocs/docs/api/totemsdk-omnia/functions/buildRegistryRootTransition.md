[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / buildRegistryRootTransition

# Function: buildRegistryRootTransition()

> **buildRegistryRootTransition**(`input`): [`ProgramTransition`](../interfaces/ProgramTransition.md)

Build a `ProgramTransition` that carries the registry root into channel state.
Co-signers read this from the signed state and verify it against the pool
anchor before co-signing.

## Parameters

### input

[`RegistryRootTransitionInputs`](../interfaces/RegistryRootTransitionInputs.md)

## Returns

[`ProgramTransition`](../interfaces/ProgramTransition.md)
