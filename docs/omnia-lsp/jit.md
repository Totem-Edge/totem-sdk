# Omnia LSP — JIT / submarine onboarding

**Status:** Phase 3 profile (not implemented in Phase 1). This document is the
protocol sketch for RFC-069 same-chain JIT onboarding.

**Canonical RFC:** [RFC-081](../rfc/RFC-081-OMNIA-LSP.md) §12.

## 1. Goal

A consumer with on-chain MIN should not have to open a channel as a separate
step. The first payment or swap should atomically deliver channel capacity and
settle the payment, or refund both legs.

## 2. Model

Two legs share one hashlock:

```text
on-chain leg (consumer)  ── hashlock H ──┐
                                         ├── both complete, or both refund
channel leg (provider)   ── hashlock H ──┘
```

- The **provider/maker** funds the channel leg.
- The **consumer/taker** funds the on-chain leg.
- The quote binds asset, amount, fee, hash scheme, lock/refund heights and both
  parties.
- Either both legs complete or both refund. There is no state where the
  consumer has paid on-chain and the provider keeps the channel value.

## 3. Quote additions

A JIT quote extends the direct-open quote with:

| Field | Meaning |
|---|---|
| `mode` | `jit` |
| `hashAlgorithm` | e.g. SHA3-256 |
| `hashlock` | 32-byte hash |
| `onChainAmount` | consumer on-chain leg |
| `channelAmount` | provider channel leg |
| `providerLockHeight` | provider refund height |
| `consumerLockHeight` | consumer refund height |
| `fee` | provider fee, bound to the quote |
| `termsHash` | binds the JIT terms |

The existing direct-open fields remain: provider/consumer identity, token,
settlement addresses, expiry and signature.

## 4. State machine

```text
QUOTED
  -> CONSUMER_FUNDED      on-chain leg broadcast
  -> PROVIDER_FUNDED      channel leg co-signed/broadcast
  -> BOTH_LOCKED          both legs confirmed
  -> SETTLED              payment/swap revealed; both legs claim
  -> REFUNDED             timeout on either leg; both refund
  -> ABORTED              before either leg is irreversible
```

Rules:

- The consumer MUST NOT reveal the preimage until both legs are locked.
- The provider MUST NOT claim the on-chain leg without delivering the channel
  leg.
- A timeout on either leg moves the transaction to `REFUNDED`, not a partial
  settlement.
- Restart recovery reconstructs the state from persisted quotes, tx ids and
  lock heights.
- Retries are idempotent by quote id and tx id.

## 5. Failure cases

| Case | Result |
|---|---|
| Consumer broadcasts on-chain leg, provider never funds | consumer refunds at `consumerLockHeight` |
| Provider funds channel leg, consumer never funds on-chain | provider refunds at `providerLockHeight` |
| One leg confirms, the other is replaced | refund both; never settle one-sided |
| Preimage leaked early | treated as a protocol violation; provider must not claim |
| Restart before both legs lock | recover from persisted state; do not double-spend |
| Reorg | wait for the agreed confirmation depth before revealing/claiming |

## 6. Acceptance

Phase 3 is accepted only when:

- a real-node recovery test proves both legs refund after each timeout;
- a restart between `CONSUMER_FUNDED` and `PROVIDER_FUNDED` recovers without
  double-spend;
- a reorg below the confirmation depth does not settle one-sided;
- the consumer UI shows the on-chain leg, channel leg, fees, lock heights and
  refund path before signing;
- the direct open/pay/close path is already proven (Phase 1).

## 7. Out of scope for Phase 1

JIT MUST NOT be advertised in a manifest (`terms.jit: false`) until the direct
path, the refund paths and the recovery tests above pass. A manifest that
advertises JIT early is a policy violation, not a beta feature.
