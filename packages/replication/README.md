# @totemsdk/replication

Runtime-neutral contracts for Totem distributed storage. This package contains
no Holepunch/native dependency; adapters live in
`@totemsdk/replication-holepunch`.

The boundary is deliberate:

- local transactional persistence stays in `@totemsdk/storage` (SQLite/FS/CAS);
- a replicated log is eventually replicated, **not** final;
- a collaborative view is eventually convergent, **not** global finality.

See RFC-057 for the full model.
