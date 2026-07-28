[**@totemsdk/edge-adapters**](../index.md)

***

[@totemsdk/edge-adapters](../index.md) / createMinimaL1PaymentPort

# Function: createMinimaL1PaymentPort()

> **createMinimaL1PaymentPort**(`config`): `EdgePaymentPort`

Minima L1 payment adapter.

Delegates transaction construction and signing to the injected `sign` function,
then broadcasts the result via the ChainStateProvider. This keeps key material
out of the adapter entirely.

For a batteries-included L1 adapter backed by @totemsdk/server's sendTransaction,
wrap sendTransaction in the sign callback:

  createMinimaL1PaymentPort({
    provider: new PureMinimaRpcProvider(rpcConfig),
    sign: ({ toAddress, amount, tokenId }) =>
      sendTransaction({ seed, addressIndex, toAddress, amount, tokenId, ... })
        .then(r => r.minedHex),
  })

## Parameters

### config

[`MinimaL1PaymentPortConfig`](../interfaces/MinimaL1PaymentPortConfig.md)

## Returns

`EdgePaymentPort`
