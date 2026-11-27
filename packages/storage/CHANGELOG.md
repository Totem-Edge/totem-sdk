# Changelog

## [Unreleased]

## [0.3.0] - 2026-11-27

### Fixed

- Journal append and `recover()` are now mutually exclusive across writers via
  a CAS append lease. Recovery defers while a live writer holds the lease and
  only truncates a tail after taking over an expired lease, so a paused append
  can no longer have its head rolled back (OMN-123).

## [0.2.1] - 2026-10-23

### Fixed

- `FileStore` conditional updates are serialized in-process and recover orphan
  locks without racing a new holder; AUD-033 lost-update conformance passes
  repeatedly.

## [0.2.0] - 2026-10-22

### Added

- `@totemsdk/storage/sqlite-sync` (`SyncSqliteStore`): synchronous SQLite adapter
  sharing the `totemsdk_kv` table, versioned codec and `{k,v,r}` envelope with
  `SqliteStore`. Includes `transaction()` and a one-time legacy-table migration
  helper.
