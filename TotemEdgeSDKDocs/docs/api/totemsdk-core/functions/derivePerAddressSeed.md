[**@totemsdk/core**](../index.md)

***

[@totemsdk/core](../index.md) / derivePerAddressSeed

# Function: derivePerAddressSeed()

> **derivePerAddressSeed**(`baseSeed`, `addressIndex`): `Uint8Array`

Derive per-address private seed matching Minima Wallet.java exactly

From Wallet.java createNewKey() (lines 498-503):
  MiniData modifier = new MiniData(new BigInteger(Integer.toString(numkeys)));
  MiniData privseed = Crypto.getInstance().hashObjects(new MiniData(mBaseSeed.getSeed()), modifier);

CRITICAL: This is DIFFERENT from deriveChainSeedJava!
- deriveChainSeedJava: hashAllObjects(MiniNumber(index), MiniData(seed)) - index first as MiniNumber
- This function: hashObjects(MiniData(baseSeed), MiniData(modifier)) - baseSeed first, both as MiniData

## Parameters

### baseSeed

`Uint8Array`

32-byte base wallet seed (from mnemonic)

### addressIndex

`number`

Address index (0, 1, 2, ... 63)

## Returns

`Uint8Array`

32-byte private seed for this address's TreeKey
