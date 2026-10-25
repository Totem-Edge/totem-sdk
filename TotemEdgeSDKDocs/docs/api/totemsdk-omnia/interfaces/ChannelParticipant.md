[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / ChannelParticipant

# Interface: ChannelParticipant

## Properties

### addressIndex

> **addressIndex**: `number`

***

### identity?

> `optional` **identity?**: [`ChannelIdentity`](ChannelIdentity.md)

Root-identity anchor (RFC-037 Amendment A). Optional during migration; when
present, the participant's channel key is bound to a wallet root identity via
an ownership proof. Verified by `verifyChannelParticipantIdentity`.

***

### partyId

> **partyId**: `string`

***

### publicKeyDigest

> **publicKeyDigest**: `string`

***

### relayEndpoint?

> `optional` **relayEndpoint?**: `string`

***

### settlementAddress?

> `optional` **settlementAddress?**: `string`

Address to receive funds on cooperative settlement. Derived from publicKeyDigest when not set.

***

### transportPubkey?

> `optional` **transportPubkey?**: `string`

Native transport identity (ed25519 pubkey) published in the participant's
signed manifest. Used by the Hyperswarm transport to authenticate the
connection; the PQ binding is the manifest signature.
