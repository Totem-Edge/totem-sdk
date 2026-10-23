# Changelog

## [Unreleased]

## [2.3.1] - 2026-10-22

### Fixed

- Release the channel update watermark when signing fails, so a retry at the same
  sequence is not poisoned by a stale payload.
- Dispatch the first `STATE_UPDATE` / `SETTLEMENT_PROPOSAL` on a newly-bound peer
  directly, closing the listener/per-peer-handler race.
- Apply the guarded signing path to HTLC add/fulfill/timeout.
