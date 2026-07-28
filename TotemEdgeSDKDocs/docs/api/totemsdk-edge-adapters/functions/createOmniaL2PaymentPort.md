[**@totemsdk/edge-adapters**](../index.md)

***

[@totemsdk/edge-adapters](../index.md) / createOmniaL2PaymentPort

# Function: createOmniaL2PaymentPort()

> **createOmniaL2PaymentPort**(`config`): `EdgePaymentPort`

Omnia L2 payment adapter.

Routes payments over Omnia payment channels using multi-hop HTLC execution.
The local node must already have open channels forming a path to the recipient.

pay() finds a route, builds a PaymentRequest, and executes atomically:
 1. Forward phase — locks HTLCs across each hop.
 2. Reveal phase — reveals the preimage in reverse to settle all hops.
 Rollback (best-effort timeoutHTLC) fires on any failure.

## Parameters

### config

[`OmniaL2PaymentPortConfig`](../interfaces/OmniaL2PaymentPortConfig.md)

## Returns

`EdgePaymentPort`
