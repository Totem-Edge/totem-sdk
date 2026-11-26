# Changelog

## [Unreleased]

## [4.0.1] - 2026-11-26

### Fixed

- Signing admission now fails closed when the journal cannot be read (OMN-108).
  An unreadable journal is not evidence that nothing was signed, so
  `beginSigningAttempt` refuses instead of treating the sequence as unused.
  Admission is also serialized per channel inside the process; a durable
  journal must provide the same guarantee across processes.
- `signingJournalIsInMemory()` is exported so a host can detect the built-in
  test journal and refuse to treat it as a durable signing watermark.

## [2.3.1] - 2026-10-22

### Fixed

- Release the channel update watermark when signing fails, so a retry at the same
  sequence is not poisoned by a stale payload.
- Dispatch the first `STATE_UPDATE` / `SETTLEMENT_PROPOSAL` on a newly-bound peer
  directly, closing the listener/per-peer-handler race.
- Apply the guarded signing path to HTLC add/fulfill/timeout.
