[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / PurchaseEvent

# Type Alias: PurchaseEvent

> **PurchaseEvent** = \{ `type`: `"runtime.persistence_ephemeral"`; \} \| \{ `intent`: [`PurchaseIntent`](../interfaces/PurchaseIntent.md); `type`: `"purchase.requested"`; \} \| \{ `manifestId`: `string`; `type`: `"purchase.discovered"`; \} \| \{ `negotiationId`: `string`; `type`: `"negotiation.opened"`; \} \| \{ `negotiationId`: `string`; `round`: `number`; `type`: `"negotiation.work_required"`; \} \| \{ `negotiationId`: `string`; `reason`: `string`; `type`: `"negotiation.work_challenge_refused"`; \} \| \{ `negotiationId`: `string`; `round`: `number`; `type`: `"negotiation.proposed"`; \} \| \{ `negotiationId`: `string`; `round`: `number`; `type`: `"negotiation.countered"`; \} \| \{ `negotiationId`: `string`; `proposalId`: `string`; `type`: `"negotiation.accepted"`; \} \| \{ `negotiationId`: `string`; `proposalId`: `string`; `type`: `"negotiation.rejected"`; \} \| \{ `negotiationId`: `string`; `type`: `"negotiation.exhausted"`; \} \| \{ `negotiationId`: `string`; `type`: `"negotiation.expired"`; \} \| \{ `superLevel`: `number`; `type`: `"work.block_found"`; \} \| \{ `agreementId`: `string`; `type`: `"purchase.authorized"`; \} \| \{ `sessionId`: `string`; `type`: `"purchase.started"`; \} \| \{ `amount`: `string`; `sessionId`: `string`; `type`: `"purchase.usage"`; `unit`: `string`; \} \| \{ `agreementId`: `string`; `recipient`: `string`; `statementId`: `string`; `type`: `"purchase.usage_statement"`; \} \| \{ `sessionId`: `string`; `type`: `"purchase.settling"`; \} \| \{ `sessionId`: `string`; `type`: `"purchase.completed"`; \} \| \{ `reason`: `string`; `sessionId`: `string`; `type`: `"purchase.failed"`; \}

Events emitted by the purchasing engine.
