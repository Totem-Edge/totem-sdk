# Changelog

## [Unreleased]

## [5.0.0] - 2026-11-27

### Breaking

- The eltoo funding script is now v2 and pins an immutable channel domain
  (`STATE(103)`, derived from the channel id). Funding writes it, both update
  and settlement branches require it unchanged, and splice outputs preserve it.
  Two channels with identical parties and delay no longer share a script or
  address, so a state signed for one cannot execute against its sibling
  (OMN-097, RFC-082). Nodes that only implement the v1 script cannot open or
  repair a v2 channel.
- Funding now requires a co-signed sequence-0 state carrying a verified close
  package, exchanged through `CHANNEL_OPEN_COSIGN` /
  `CHANNEL_OPEN_COSIGN_REPLY` before the funding transaction is broadcast
  (OMN-098, RFC-082). `finalizeChannelOpening` refuses a broadcast without it;
  `allowMissingInitialState` / `allowLocalOnlyOpen` are explicit local-dev
  escapes only.

### Added

- `signInitialChannelState`, `deriveChannelDomain`, `STATE_DOMAIN_PORT`,
  `SignerRefusalError`, `SignerOutcomeUnknownError` and
  `markSigningAttemptAmbiguous`.
- `confirmationDepth` is re-exported from `@totemsdk/core` as the single
  confirmation definition (OMN-124).
- Epoch reservations (`EpochClaim`, `unfinishedClaims`) make VTXO admission
  crash-safe and reject conflicting spends before a signature exists (OMN-106).
- Authenticated epoch-history replay rejects a forged signature, two roots for
  one epoch and double-consumed inputs (OMN-107).
- Transfer/split/merge outputs are uniqueness-checked; conservation rejects
  duplicate, overlapping and negative records (OMN-117/118).

### Fixed

- Audit-3 findings OMN-099 through OMN-127: activation requires acknowledgement
  and depth, update coins bind sequence/commitment/amount/lineage, unilateral
  settlement is staged, distributed payments and swaps are journaled, watcher
  actions take the channel lock, routing rejects malformed envelopes and
  non-active channels, signing derives its amount and refuses missing policy
  amounts, Axia indices are strictly validated, fee earn-proofs are consumed
  once, TxPoW parse failures are invalid, and virtual-channel parties must
  differ.

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
