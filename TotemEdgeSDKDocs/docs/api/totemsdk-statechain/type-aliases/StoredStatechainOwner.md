[**@totemsdk/statechain**](../index.md)

***

[@totemsdk/statechain](../index.md) / StoredStatechainOwner

# Type Alias: StoredStatechainOwner

> **StoredStatechainOwner** = `Omit`\<[`StatechainOwner`](../interfaces/StatechainOwner.md), `"sign"`\>

Owner snapshot as persisted: `sign` is a runtime capability (a closure over
the caller's WOTS key) that cannot be serialised, so it is stripped on save.
Every durable recovery field (`publicKeyDigest`, `transferKeySeed`) is kept;
a caller re-attaches signing capability when it loads a chain into memory.
