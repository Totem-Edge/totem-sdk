[**@totemsdk/lookup-protocol**](../index.md)

***

[@totemsdk/lookup-protocol](../index.md) / SessionTicketRef

# Interface: SessionTicketRef

RFC-032 Amendment A: reference to a node-issued session ticket, used to
amortise one-time WOTS use. `seq` is a client-monotonic counter that provides
anti-replay for ticket-authenticated messages.

## Properties

### seq

> **seq**: `number`

***

### ticketId

> **ticketId**: `string`
