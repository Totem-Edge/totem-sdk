[**@totemsdk/omnia-relay**](../index.md)

***

[@totemsdk/omnia-relay](../index.md) / ApprovalQueueOptions

# Interface: ApprovalQueueOptions

RFC-035 B5 — consent queue for peer-coordination approvals.

Accepting a factory/virtual-channel/splice proposal emits a WOTS signature, so
every request needs an explicit user decision. Two properties matter and were
previously left to each wallet:

 - **One decision at a time.** A wallet UI can show one modal at a time. The
   earlier PWA implementation kept a single pending slot, so a second request
   overwrote the first and the first handler waited forever on a promise
   nobody could resolve.
 - **Fail closed.** Teardown (lock, tab close, host stop) denies everything
   outstanding, and an unanswered request expires rather than signing later.

## Properties

### onChange?

> `optional` **onChange?**: () => `void`

Called whenever the head of the queue changes (UI re-render signal).

#### Returns

`void`

***

### timeoutMs?

> `optional` **timeoutMs?**: `number`

Deny a request that is not answered within this window.
