[**@totemsdk/omnia-router**](../index.md)

***

[@totemsdk/omnia-router](../index.md) / ExpiryPolicy

# Interface: ExpiryPolicy

## Properties

### defaultContestDelayBlocks?

> `optional` **defaultContestDelayBlocks?**: `number`

Contest delay assumed for a channel that does not declare one. Default 0,
which reproduces the legacy one-block spread. Production hosts pass the
documented eltoo default (256) instead.

***

### minHopExpiryDelta?

> `optional` **minHopExpiryDelta?**: `bigint`

Operator floor, in blocks per hop. Used only when it exceeds the derived
value — it cannot shrink the spread below a channel's contest period.

***

### minLeadBlocks?

> `optional` **minLeadBlocks?**: `bigint`

Blocks of headroom the earliest HTLC must keep above the tip. Default 0.

***

### recoveryMarginBlocks?

> `optional` **recoveryMarginBlocks?**: `number`

Blocks added on top of the contest delay for confirmation/recovery.
Default 1.

***

### requireContestDelay?

> `optional` **requireContestDelay?**: `boolean`

Refuse to route through a channel with no declared contest delay rather
than assuming one. Default false.

***

### tipBlock?

> `optional` **tipBlock?**: `bigint`

Current chain tip, when known, so the window can be checked.
