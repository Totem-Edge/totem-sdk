[**@totemsdk/realtime**](../index.md)

***

[@totemsdk/realtime](../index.md) / PortfolioEntry

# Interface: PortfolioEntry

A single portfolio entry representing one asset held at an address.

kind classification:
  'native'  — tokenid === '0x00' (Minima)
  'nft'     — artimage present AND decimals === 0 AND total === '1'
  'token'   — everything else with a non-'0x00' tokenid

## Properties

### address

> **address**: `string`

***

### artimage?

> `optional` **artimage?**: `string`

***

### coins?

> `optional` **coins?**: `number`

Number of UTXOs contributing to this balance

***

### confirmed

> **confirmed**: `string`

***

### decimals

> **decimals**: `number`

***

### description?

> `optional` **description?**: `string` \| `null`

Token description

***

### icon?

> `optional` **icon?**: `string` \| `null`

Token icon URL (may be a data URL or hosted URL)

***

### kind

> **kind**: `"native"` \| `"token"` \| `"nft"`

***

### name

> **name**: `string`

***

### owner?

> `optional` **owner?**: `string` \| `null`

Token owner address

***

### sendable

> **sendable**: `string`

***

### ticker

> **ticker**: `string`

***

### tokenid

> **tokenid**: `string`

***

### total

> **total**: `string`

***

### unconfirmed

> **unconfirmed**: `string`

***

### url?

> `optional` **url?**: `string` \| `null`

Token website URL

***

### webvalidate?

> `optional` **webvalidate?**: `string`
