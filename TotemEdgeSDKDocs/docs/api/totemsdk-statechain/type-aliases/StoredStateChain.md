[**@totemsdk/statechain**](../index.md)

***

[@totemsdk/statechain](../index.md) / StoredStateChain

# Type Alias: StoredStateChain

> **StoredStateChain** = `Omit`\<[`StateChain`](../interfaces/StateChain.md), `"currentOwner"`\> & `object`

Chain record as persisted (owner minus signing capability).

## Type Declaration

### currentOwner

> `readonly` **currentOwner**: [`StoredStatechainOwner`](StoredStatechainOwner.md)
