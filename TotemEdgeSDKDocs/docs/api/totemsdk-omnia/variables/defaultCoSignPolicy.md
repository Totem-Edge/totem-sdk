[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / defaultCoSignPolicy

# Variable: defaultCoSignPolicy

> `const` **defaultCoSignPolicy**: [`CoSignPolicy`](../interfaces/CoSignPolicy.md)

Safe default: never co-sign a local balance decrease or the removal of a
local pending HTLC. Applications may install a narrower policy that approves
specific receive/forward/refund effects.
