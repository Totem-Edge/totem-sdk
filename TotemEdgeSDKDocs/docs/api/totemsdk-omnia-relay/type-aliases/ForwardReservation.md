[**@totemsdk/omnia-relay**](../index.md)

***

[@totemsdk/omnia-relay](../index.md) / ForwardReservation

# Type Alias: ForwardReservation

> **ForwardReservation** = \{ `link`: [`HtlcLink`](../interfaces/HtlcLink.md); `ok`: `true`; \} \| \{ `existing`: [`HtlcLink`](../interfaces/HtlcLink.md); `ok`: `false`; `reason`: `"hashlock"` \| `"incoming"`; \}

Outcome of an atomic forward reservation (OMN-084).

`ok: false` means another forward already owns this hashlock or this incoming
HTLC. The existing link is returned so the caller can reconcile rather than
creating a second outgoing obligation.
