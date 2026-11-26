[**@totemsdk/replication**](../index.md)

***

[@totemsdk/replication](../index.md) / DatasetDescriptor

# Interface: DatasetDescriptor

## Properties

### codecVersion

> `readonly` **codecVersion**: `number`

Versioned Totem codec version (not raw JSON).

***

### datasetId

> `readonly` **datasetId**: `string`

***

### datasetVersion

> `readonly` **datasetVersion**: `number`

***

### encryptionProfile

> `readonly` **encryptionProfile**: `string`

***

### migration?

> `readonly` `optional` **migration?**: `object`

#### fromVersion

> `readonly` **fromVersion**: `number`

#### rule

> `readonly` **rule**: `string`

***

### retention

> `readonly` **retention**: `"full"` \| `"sparse"` \| `"bounded"`

***

### writerModel

> `readonly` **writerModel**: [`WriterModel`](../type-aliases/WriterModel.md)

***

### writerSetRef?

> `readonly` `optional` **writerSetRef?**: `string`
