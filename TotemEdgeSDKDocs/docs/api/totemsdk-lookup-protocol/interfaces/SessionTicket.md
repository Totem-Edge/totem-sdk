[**@totemsdk/lookup-protocol**](../index.md)

***

[@totemsdk/lookup-protocol](../index.md) / SessionTicket

# Interface: SessionTicket

RFC-032-A: a node-signed session ticket.

## Properties

### expiresAt

> **expiresAt**: `number`

***

### issuedAt

> **issuedAt**: `number`

***

### maxRequests

> **maxRequests**: `number`

***

### nodeId

> **nodeId**: `string`

***

### signature

> **signature**: `string`

Node WOTS signature (hex) over [sessionTicketDigest](../functions/sessionTicketDigest.md).

***

### subject

> **subject**: `string`

Root public key (hex) the ticket is bound to.

***

### ticketId

> **ticketId**: `string`
