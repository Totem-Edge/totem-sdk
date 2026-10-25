[**@totemsdk/omnia-host**](../index.md)

***

[@totemsdk/omnia-host](../index.md) / ObservationSnapshotState

# Interface: ObservationSnapshotState

Snapshot the host's current state at a single journal boundary. The cursor is
the journal head, so `GET /observe/events?after=<cursor>` has no gap or
duplication relative to this snapshot.

## Properties

### channels

> **channels**: `unknown`[]

***

### factories

> **factories**: `unknown`[]

***

### operations

> **operations**: `unknown`[]

***

### pools

> **pools**: `unknown`[]

***

### vtxoPools

> **vtxoPools**: `unknown`[]

***

### vtxos

> **vtxos**: `unknown`[]
