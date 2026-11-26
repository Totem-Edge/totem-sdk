[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / AcceptChannelOptions

# Interface: AcceptChannelOptions

## Properties

### allowShortContestDelay?

> `optional` **allowShortContestDelay?**: `boolean`

Accept a contest delay below the default floor. Test/dev channels only: a
short window weakens unilateral-close protection.

***

### localPublicKeyDigest?

> `optional` **localPublicKeyDigest?**: `string`

WOTS public key digest of the accepting host. When set, the proposal's
local party must match it.

***

### minContestDelayBlocks?

> `optional` **minContestDelayBlocks?**: `number`

Minimum accepted contest delay. Default: `ELTOO_CONTEST_DELAY_BLOCKS` (256).

***

### remoteTransportPubkey?

> `optional` **remoteTransportPubkey?**: `string`

Authenticated transport identity of the proposing peer. When set (and the
proposal carries `remoteParty.transportPubkey`), the two must match.

***

### requireChainProvider?

> `optional` **requireChainProvider?**: `boolean`

Reject network proposals when no chain provider is available.
