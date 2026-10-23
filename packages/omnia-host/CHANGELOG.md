# Changelog

## [Unreleased]

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
