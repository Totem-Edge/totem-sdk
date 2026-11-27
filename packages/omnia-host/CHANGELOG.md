# Changelog

## [Unreleased]

## [0.17.0] - 2026-11-27

### Breaking

- Opening a channel now requires a peer-co-signed sequence-0 state with a
  verified close package. `submitOpenChannel` and `openChannel` exchange
  `CHANNEL_OPEN_COSIGN` before funding; a local-only open requires the explicit
  `allowLocalOnlyOpen` flag (OMN-098, RFC-082).
- `releasePoolAllocation` now requires `recovery` evidence and a configured
  `allocationRecoveryVerifier`; a release without verified recovery is refused,
  not treated as recovered capital (OMN-114).
- Routing graphs only advertise active, funded channels (OMN-120).

### Fixed

- Watcher actions take the shared per-channel mutation coordinator and reload
  the authoritative channel after acquiring it; scans stay single-flight
  (OMN-105).
- An interrupted external signer seals the sequence and marks the intent
  ambiguous instead of releasing the guard (OMN-109).
- Policy signing refuses a request with no amount, a non-integer amount or a
  negative amount; the amount is derived from the transition (OMN-121).
- Pool allocation checks risk-adjusted headroom before executing, binds the
  target to the authorised amount, and refuses execution on mismatch
  (OMN-112/113).
- Fallback routing edges and malformed envelopes are refused (OMN-119).

## [0.16.1] - 2026-11-26

### Fixed

- Warn at startup when the built-in in-memory signing journal is still
  installed (OMN-108): its watermark does not survive a restart and independent
  processes do not share it. Pass a durable `signingJournal` for production.
- The watcher no longer treats any successor coin as channel continuity
  (OMN-096). It compares the successor's on-chain sequence with the latest
  signed local state, raises a contestable close when the published state is
  stale, scans single-flight, and contests the live coin rather than the spent
  original funding coin.

## [0.15.2] - 2026-11-25

### Fixed

- `totem_omniaGetChannelState` now also re-checks channels in `opening`. The
  initiator stays in `opening` until its funding coin has depth and no event
  fires for it, so a channel opened against a real chain never became active.
  Both `opening` and `funding_pending` are promoted on read, matching the
  acceptor path.

## [0.13.1] - 2026-10-24

### Fixed

- `/observe/snapshot` now serializes BigInt values in channel parties, factory
  participants and operation records. The AWS v1 gate found the endpoint
  throwing `Do not know how to serialize a BigInt`.

## [0.13.0] - 2026-10-23

### Changed

- `totem_omniaPayMultiHop` now uses the shared intent-based request contract
  (`toPartyId`, `amount`, `tokenId`, `hashlock`, `preimage`, `expiryBlock`,
  optional `route`/`targetTokenId`). Cross-token routes use the host executor.

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
