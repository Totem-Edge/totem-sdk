[**@totemsdk/core**](../index.md)

***

[@totemsdk/core](../index.md) / ScriptDescriptor

# Interface: ScriptDescriptor

## Properties

### address

> **address**: `string`

***

### externalSignatures?

> `optional` **externalSignatures?**: [`ExternalSignature`](ExternalSignature.md)[]

***

### extraScripts?

> `optional` **extraScripts?**: `Map`\<`string`, `string`\>

***

### htlcHash?

> `optional` **htlcHash?**: `string`

***

### htlcPreimage?

> `optional` **htlcPreimage?**: `string`

***

### mastProof?

> `optional` **mastProof?**: [`MMRProof`](MMRProof.md)

***

### multisigKeys?

> `optional` **multisigKeys?**: `string`[]

***

### multisigThreshold?

> `optional` **multisigThreshold?**: `number`

***

### script

> **script**: `string`

***

### scriptType

> **scriptType**: [`ScriptType`](../type-aliases/ScriptType.md)

***

### stateVariables?

> `optional` **stateVariables?**: [`StateValue`](StateValue.md)[]

***

### storeState?

> `optional` **storeState?**: `boolean`

***

### timelockBlock?

> `optional` **timelockBlock?**: `bigint`

***

### verifyOutExpectations?

> `optional` **verifyOutExpectations?**: [`VerifyOutExpectation`](VerifyOutExpectation.md)[]

***

### wotsRootPublicKey?

> `optional` **wotsRootPublicKey?**: `string`
