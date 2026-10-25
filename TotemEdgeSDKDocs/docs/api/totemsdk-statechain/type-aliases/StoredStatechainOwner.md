[**@totemsdk/statechain**](../index.md)

***

[@totemsdk/statechain](../index.md) / StoredStatechainOwner

# Type Alias: StoredStatechainOwner

> **StoredStatechainOwner** = `Omit`\<[`StatechainOwner`](../interfaces/StatechainOwner.md), `"signTree"`\>

Owner snapshot as persisted: `signTree` is a runtime capability (a closure
over the caller's TreeKey) that cannot be serialised, so it is stripped on
save. Every durable recovery field (`publicKeyDigest`) is kept; a caller
re-attaches signing capability when it loads a chain into memory.
