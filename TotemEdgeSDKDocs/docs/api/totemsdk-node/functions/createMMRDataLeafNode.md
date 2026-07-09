[**@totemsdk/node**](../index.md)

***

[@totemsdk/node](../index.md) / createMMRDataLeafNode

# Function: createMMRDataLeafNode()

> **createMMRDataLeafNode**(`pubkey`, `sumValue?`): [`MMRData`](../interfaces/MMRData.md)

Create MMRData leaf node matching Minima's MMRData.CreateMMRDataLeafNode

From MMRData.java:
  MiniData hash = Crypto.getInstance().hashAllObjects(MiniNumber.ZERO, zData, zSumValue);

CRITICAL: Crypto.hashAllObjects uses writeDataStream for Streamables:
- MiniNumber: scale + len + data (see serializeMiniNumber)
- MiniData: 4-byte length + data (see serializeMiniData)

For TreeKeyNode, zData is the Winternitz public key (MiniData) and zSumValue is ZERO

Serialization order:
1. MiniNumber.ZERO: [0x00, 0x01, 0x00]
2. MiniData (pubkey): [4-byte length] + [bytes] (writeDataStream, NOT writeHashToStream)
3. MiniNumber.ZERO: [0x00, 0x01, 0x00]

## Parameters

### pubkey

`Bytes`

### sumValue?

`bigint`

## Returns

[`MMRData`](../interfaces/MMRData.md)
