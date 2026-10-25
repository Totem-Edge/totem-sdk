[**@totemsdk/recursive-mast**](../index.md)

***

[@totemsdk/recursive-mast](../index.md) / RecoveryAvailabilityPolicy

# Interface: RecoveryAvailabilityPolicy

Explicit availability policy for the recovery path, separate from content authorization.

## Properties

### minimumRecoveryReplicas?

> `readonly` `optional` **minimumRecoveryReplicas?**: `number`

Minimum replicas that must hold the recovery branch. Reported for
operators; **never** used to deny a recovery operation (that would
reintroduce the cycle the gate exists to break).
