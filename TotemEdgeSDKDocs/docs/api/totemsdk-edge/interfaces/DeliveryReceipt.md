[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / DeliveryReceipt

# Interface: DeliveryReceipt

A durable delivery receipt.

Means ONLY: "the remote machine durably received/claimed this exact logical
message (messageId)". It does NOT mean "I accept your economic proposal" —
that is ProposalAcceptance. Never conflate the two.

## Properties

### durablyProcessed

> **durablyProcessed**: `true`

Always true — a receipt is only produced after durable processing.

***

### messageId

> **messageId**: `string`

***

### receivedAt

> **receivedAt**: `number`

Epoch ms when the remote durably processed (claimed) the message.
