[**@totemsdk/core**](../index.md)

***

[@totemsdk/core](../index.md) / derivePKdigest

# Function: derivePKdigest()

> **derivePKdigest**(`seed`, `i`, `ps?`): `Uint8Array`

Derive WOTS public key digest from seed and key index

The key index is mixed into the seed first (deriveIndexedSeed),
then expanded using GMSSRandom to get unique chain seeds.

Matches WinternitzOTSignature.getPublicKey():
  int rounds = (1 << w) - 1;  // 255 for w=8
  for (int i = 0; i < keysize; i++) {
    hashPrivateKeyBlock(i, rounds, buf, pos);
  }
  return H(buf);

## Parameters

### seed

`Uint8Array`

### i

`number`

### ps?

[`ParamSet`](../type-aliases/ParamSet.md) = `...`

## Returns

`Uint8Array`
