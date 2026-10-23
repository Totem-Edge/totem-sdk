# Changelog

## [Unreleased]

## [0.12.0] - 2026-10-23

### Added

- Durable host state for factories, virtual channels, splice proposals/acceptances,
  VTXO pools/claims/receipts and liquidity pools/positions, persisted through
  `@totemsdk/storage/sqlite-sync` (same codec/envelope as the channel/operation
  stores).
- `PersistentMap` with explicit host-state format versioning (unsupported formats
  refuse to open) and Map/Set/Date tagging; runtime signer/lease handles are
  stripped, never persisted.

### Fixed

- Factory registry (and the other host-owned registries) now survives a host
  restart, addressing the RFC-063 Tier-1 durable-state blocker.

## [0.11.0] - 2026-10-22

### Added

- Durable, replayable observation feed: `GET /observe/snapshot` and
  `GET /observe/events?after=<cursor>` (SSE), with a storage-backed journal,
  redacting emitter and snapshot projection.
- Emission on the mutation path for operations, commands, channels/funding/HTLC/
  settlement, factory/VC, splice, VTXO, pool and transport transitions.

### Changed

- Channel store and operation journal persist through `@totemsdk/storage`
  (`sqlite-sync`) with an explicit store format version: legacy tables migrate,
  unsupported formats refuse to open.
- Removed the direct `better-sqlite3` dependency.
