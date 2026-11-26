[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / EdgeTotemCapabilitiesInput

# Interface: EdgeTotemCapabilitiesInput

Structural projection consumed by the Connect capability mapper. This is
only the input port for fields mapped below, not Connect's full capability
model. Keeping it local means the optional Connect peer is also optional for
strict declaration consumers. Connect's TotemCapabilities satisfies this port.

## Properties

### account

> **account**: `Readonly`\<`Record`\<`"multiAddress"` \| `"accountSwitcher"`, `boolean`\>\>

***

### chain

> **chain**: `Readonly`\<`Record`\<`"hostedProvider"` \| `"pureMinimaRpc"` \| `"lookupNode"` \| `"localProofVerify"` \| `"pearRuntime"` \| `"hyperswarm"`, `boolean`\>\>

***

### omnia

> **omnia**: `Readonly`\<`Record`\<`"channels"` \| `"routing"` \| `"multiHop"` \| `"crossTokenSwap"` \| `"factory"` \| `"virtualChannels"` \| `"splicing"` \| `"hyperswarm"`, `boolean`\>\>

***

### qvac

> **qvac**: `Readonly`\<`Record`\<`"paymentIntents"` \| `"explanations"`, `boolean`\>\>

***

### scripting

> **scripting**: `Readonly`\<`Record`\<`"kissvm"`, `boolean`\>\>

***

### statechain

> **statechain**: `Readonly`\<`Record`\<`"supported"` \| `"blindSE"`, `boolean`\>\>

***

### txpow

> **txpow**: `Readonly`\<`Record`\<`"localMining"` \| `"progressEvents"`, `boolean`\>\>

***

### wallet

> **wallet**: `Readonly`\<`Record`\<`"selfCustody"` \| `"wotsTreeKey"` \| `"rootIdentity"` \| `"seedExport"`, `boolean`\>\>
