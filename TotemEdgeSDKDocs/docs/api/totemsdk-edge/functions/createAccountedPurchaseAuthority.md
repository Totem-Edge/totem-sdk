[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / createAccountedPurchaseAuthority

# Function: createAccountedPurchaseAuthority()

> **createAccountedPurchaseAuthority**(`options`): [`AccountedPurchaseAuthority`](../interfaces/AccountedPurchaseAuthority.md)

Wrap the agent-policy accounting authority as a purchase authority port.
The returned `approve` is a drop-in for the buyer's `AuthorityPort`; callers
that need the reservation to settle MUST drive `commit`/`abort` from the
purchase lifecycle (`recover`/`reconcile` cover the crash window).

## Parameters

### options

[`AccountedPurchaseAuthorityOptions`](../interfaces/AccountedPurchaseAuthorityOptions.md)

## Returns

[`AccountedPurchaseAuthority`](../interfaces/AccountedPurchaseAuthority.md)
