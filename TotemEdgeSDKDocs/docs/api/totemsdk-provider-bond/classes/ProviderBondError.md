[**@totemsdk/provider-bond**](../index.md)

***

[@totemsdk/provider-bond](../index.md) / ProviderBondError

# Class: ProviderBondError

## Extends

- `Error`

## Extended by

- [`ProviderManifestError`](ProviderManifestError.md)
- [`ProviderIdentityError`](ProviderIdentityError.md)
- [`BondProofError`](BondProofError.md)
- [`ProbeError`](ProbeError.md)
- [`IncidentError`](IncidentError.md)
- [`ProviderScoreError`](ProviderScoreError.md)
- [`ProviderPolicyError`](ProviderPolicyError.md)
- [`ProviderRegistryError`](ProviderRegistryError.md)
- [`ProviderSerializationError`](ProviderSerializationError.md)

## Constructors

### Constructor

> **new ProviderBondError**(`message`, `code?`, `details?`): `ProviderBondError`

#### Parameters

##### message

`string`

##### code?

`string`

##### details?

`unknown`

#### Returns

`ProviderBondError`

#### Overrides

`Error.constructor`

## Properties

### code?

> `optional` **code?**: `string`

***

### details?

> `optional` **details?**: `unknown`

***

### message

> **message**: `string`

#### Inherited from

`Error.message`

***

### name

> **name**: `string`

#### Inherited from

`Error.name`

***

### stack?

> `optional` **stack?**: `string`

#### Inherited from

`Error.stack`
