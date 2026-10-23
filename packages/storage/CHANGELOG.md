# Changelog

## [Unreleased]

## [0.2.0] - 2026-10-22

### Added

- `@totemsdk/storage/sqlite-sync` (`SyncSqliteStore`): synchronous SQLite adapter
  sharing the `totemsdk_kv` table, versioned codec and `{k,v,r}` envelope with
  `SqliteStore`. Includes `transaction()` and a one-time legacy-table migration
  helper.
