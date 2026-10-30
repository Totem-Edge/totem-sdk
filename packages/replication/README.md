# @totemsdk/replication

Runtime-neutral contracts for Totem distributed storage. This package contains
no Holepunch/native dependency; adapters live in
`@totemsdk/replication-holepunch`.

The boundary is deliberate:

- local transactional persistence stays in `@totemsdk/storage` (SQLite/FS/CAS);
- a replicated log is eventually replicated, **not** final;
- a collaborative view is eventually convergent, **not** global finality.

See RFC-057 for the full model.


## Testing

Tests live outside the published package in `tests/unit/replication/`. Qualification profiles are recorded in `qualification/registry.json`. Package `test:*` scripts are repository delegates; tests are not shipped.
