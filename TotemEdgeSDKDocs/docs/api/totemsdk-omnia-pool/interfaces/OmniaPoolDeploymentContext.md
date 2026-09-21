[**@totemsdk/omnia-pool**](../index.md)

***

[@totemsdk/omnia-pool](../index.md) / OmniaPoolDeploymentContext

# Interface: OmniaPoolDeploymentContext

## Properties

### chainProvider?

> `optional` **chainProvider?**: `ChainStateProvider`

Chain state provider for coin lookup and broadcast.

***

### fundingVerifier?

> `optional` **fundingVerifier?**: `LiquidityChainFundingVerifier`

On-chain funding verifier — required to confirm LP deposits.

***

### leaseBundle?

> `optional` **leaseBundle?**: `WotsLeaseBundle`

WOTS lease bundle for pool-level signing.

***

### signer?

> `optional` **signer?**: [`PoolSigner`](PoolSigner.md)

Optional signer for pool-level operations.
