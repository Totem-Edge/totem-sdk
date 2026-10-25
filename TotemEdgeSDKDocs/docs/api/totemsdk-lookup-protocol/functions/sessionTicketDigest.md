[**@totemsdk/lookup-protocol**](../index.md)

***

[@totemsdk/lookup-protocol](../index.md) / sessionTicketDigest

# Function: sessionTicketDigest()

> **sessionTicketDigest**(`ticket`): `Uint8Array`

RFC-032-A: digest a session ticket signs/verifies — the ticket payload minus
its `signature`, domain-separated so it can never be confused with an
auth-envelope digest.

## Parameters

### ticket

`Omit`\<[`SessionTicket`](../interfaces/SessionTicket.md), `"signature"`\>

## Returns

`Uint8Array`
