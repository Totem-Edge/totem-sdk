[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / CustodyContext

# Interface: CustodyContext

## Properties

### canFreeze?

> `optional` **canFreeze?**: `boolean`

***

### canMoveFunds?

> `optional` **canMoveFunds?**: `boolean`

***

### disclosureHash?

> `optional` **disclosureHash?**: `string`

Hash of the operator's disclosure/terms; bound into the signed payload.

***

### disclosureUrl?

> `optional` **disclosureUrl?**: `string`

Hosted only: public URL of the full disclosure/terms.

***

### disclosureVersion?

> `optional` **disclosureVersion?**: `string`

***

### jurisdiction?

> `optional` **jurisdiction?**: `string`

Hosted only: jurisdiction of the legal entity.

***

### keyManagement?

> `optional` **keyManagement?**: `"host"` \| `"wallet"` \| `"kms"` \| `"hsm"` \| `"mpc"`

***

### legalEntity?

> `optional` **legalEntity?**: `string`

Hosted only: legal entity responsible for custody.

***

### license?

> `optional` **license?**: `string`

Hosted only: licence/registration reference, if any.

***

### mitigation?

> `optional` **mitigation?**: `string`

***

### mode

> **mode**: [`CustodyMode`](../type-aliases/CustodyMode.md)

***

### operatorDiscretion?

> `optional` **operatorDiscretion?**: `boolean`

***

### operatorId?

> `optional` **operatorId?**: `string`

Hosted only: stable operator id (public key / service id).

***

### policySummary?

> `optional` **policySummary?**: `string`

***

### reason?

> `optional` **reason?**: `string`

Trust-minimised: why it is trust-minimised and how it is mitigated.

***

### receiptTransferability?

> `optional` **receiptTransferability?**: `"none"` \| `"restricted"` \| `"transferable"`

***

### withdrawalTerms?

> `optional` **withdrawalTerms?**: `string`
