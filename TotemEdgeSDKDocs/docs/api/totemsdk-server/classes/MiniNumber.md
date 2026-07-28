[**@totemsdk/server**](../index.md)

***

[@totemsdk/server](../index.md) / MiniNumber

# Class: MiniNumber

## Constructors

### Constructor

> **new MiniNumber**(`value`): `MiniNumber`

#### Parameters

##### value

`string` \| `number` \| `bigint` \| `MiniNumber`

#### Returns

`MiniNumber`

## Properties

### scale

> `readonly` **scale**: `number`

***

### unscaled

> `readonly` **unscaled**: `bigint`

***

### EIGHT

> `readonly` `static` **EIGHT**: `MiniNumber`

***

### FIFTY

> `readonly` `static` **FIFTY**: `MiniNumber`

***

### FIVEONE12

> `readonly` `static` **FIVEONE12**: `MiniNumber`

***

### FOUR

> `readonly` `static` **FOUR**: `MiniNumber`

***

### MINUSONE

> `readonly` `static` **MINUSONE**: `MiniNumber`

***

### ONE

> `readonly` `static` **ONE**: `MiniNumber`

***

### SIXTEEN

> `readonly` `static` **SIXTEEN**: `MiniNumber`

***

### SIXTYFOUR

> `readonly` `static` **SIXTYFOUR**: `MiniNumber`

***

### THIRTYTWO

> `readonly` `static` **THIRTYTWO**: `MiniNumber`

***

### THOUSAND24

> `readonly` `static` **THOUSAND24**: `MiniNumber`

***

### THREE

> `readonly` `static` **THREE**: `MiniNumber`

***

### TWELVE

> `readonly` `static` **TWELVE**: `MiniNumber`

***

### TWENTY

> `readonly` `static` **TWENTY**: `MiniNumber`

***

### TWO

> `readonly` `static` **TWO**: `MiniNumber`

***

### TWOFIVESIX

> `readonly` `static` **TWOFIVESIX**: `MiniNumber`

***

### ZERO

> `readonly` `static` **ZERO**: `MiniNumber`

## Methods

### abs()

> **abs**(): `MiniNumber`

#### Returns

`MiniNumber`

***

### add()

> **add**(`other`): `MiniNumber`

#### Parameters

##### other

`MiniNumber`

#### Returns

`MiniNumber`

***

### ceil()

> **ceil**(): `MiniNumber`

#### Returns

`MiniNumber`

***

### compareTo()

> **compareTo**(`other`): `number`

#### Parameters

##### other

`MiniNumber`

#### Returns

`number`

***

### decimalPlaces()

> **decimalPlaces**(): `number`

#### Returns

`number`

***

### decrement()

> **decrement**(): `MiniNumber`

#### Returns

`MiniNumber`

***

### div()

> **div**(`other`): `MiniNumber`

#### Parameters

##### other

`MiniNumber`

#### Returns

`MiniNumber`

***

### floor()

> **floor**(): `MiniNumber`

#### Returns

`MiniNumber`

***

### getAsBigDecimal()

> **getAsBigDecimal**(): `string`

#### Returns

`string`

***

### getAsBigInteger()

> **getAsBigInteger**(): `string`

#### Returns

`string`

***

### increment()

> **increment**(): `MiniNumber`

#### Returns

`MiniNumber`

***

### isEqual()

> **isEqual**(`other`): `boolean`

#### Parameters

##### other

`MiniNumber`

#### Returns

`boolean`

***

### isLess()

> **isLess**(`other`): `boolean`

#### Parameters

##### other

`MiniNumber`

#### Returns

`boolean`

***

### isLessEqual()

> **isLessEqual**(`other`): `boolean`

#### Parameters

##### other

`MiniNumber`

#### Returns

`boolean`

***

### isMore()

> **isMore**(`other`): `boolean`

#### Parameters

##### other

`MiniNumber`

#### Returns

`boolean`

***

### isMoreEqual()

> **isMoreEqual**(`other`): `boolean`

#### Parameters

##### other

`MiniNumber`

#### Returns

`boolean`

***

### modulo()

> **modulo**(`other`): `MiniNumber`

#### Parameters

##### other

`MiniNumber`

#### Returns

`MiniNumber`

***

### mult()

> **mult**(`other`): `MiniNumber`

#### Parameters

##### other

`MiniNumber`

#### Returns

`MiniNumber`

***

### negate()

> **negate**(): `MiniNumber`

#### Returns

`MiniNumber`

***

### pow()

> **pow**(`n`): `MiniNumber`

#### Parameters

##### n

`number`

#### Returns

`MiniNumber`

***

### setSignificantDigits()

> **setSignificantDigits**(`d`): `MiniNumber`

#### Parameters

##### d

`number`

#### Returns

`MiniNumber`

***

### sqrt()

> **sqrt**(): `MiniNumber`

#### Returns

`MiniNumber`

***

### sub()

> **sub**(`other`): `MiniNumber`

#### Parameters

##### other

`MiniNumber`

#### Returns

`MiniNumber`

***

### toNumber()

> **toNumber**(): `number`

#### Returns

`number`

***

### toString()

> **toString**(): `string`

#### Returns

`string`
