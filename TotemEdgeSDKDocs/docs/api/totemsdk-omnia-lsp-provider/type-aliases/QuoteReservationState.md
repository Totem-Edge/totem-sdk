[**@totemsdk/omnia-lsp-provider**](../index.md)

***

[@totemsdk/omnia-lsp-provider](../index.md) / QuoteReservationState

# Type Alias: QuoteReservationState

> **QuoteReservationState** = `"reserved"` \| `"consumed"` \| `"released"`

Quote reservations (OMN-068).

Admission validates a request against the manifest's advertised capacity, but
the manifest is static: without a ledger, N concurrent quotes each fit inside
capacity while their sum does not. The facade now reserves the provider-side
amount when it issues a quote, releases it on expiry or a failed open, and
consumes it atomically when a quote is redeemed.

The in-memory ledger is the default. A production provider injects an
implementation backed by durable storage; the interface is intentionally
small so that the durable version can make `consume` a single transaction.
