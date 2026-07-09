[**@totemsdk/node**](../index.md)

***

[@totemsdk/node](../index.md) / createMMRDataParentNode

# Function: createMMRDataParentNode()

> **createMMRDataParentNode**(`left`, `right`): [`MMRData`](../interfaces/MMRData.md)

Create MMRData parent node matching Minima's MMRData.CreateMMRDataParentNode

From MMRData.java:
  MiniNumber sumvalue = zLeft.getValue().add(zRight.getValue());
  MiniData combinedhash = Crypto.getInstance().hashAllObjects(
    MiniNumber.ONE, zLeft.getData(), zRight.getData(), sumvalue);

CRITICAL: The getData() returns MiniData (the hash), which is serialized
with writeDataStream (4-byte length) in hashAllObjects.

Serialization order:
1. MiniNumber.ONE: [0x00, 0x01, 0x01]
2. MiniData (left.data): [4-byte length] + [bytes]
3. MiniData (right.data): [4-byte length] + [bytes]
4. MiniNumber (sumvalue): serialized MiniNumber

## Parameters

### left

[`MMRData`](../interfaces/MMRData.md)

### right

[`MMRData`](../interfaces/MMRData.md)

## Returns

[`MMRData`](../interfaces/MMRData.md)
