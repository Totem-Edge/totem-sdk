[**@totemsdk/pear**](../index.md)

***

[@totemsdk/pear](../index.md) / Logger

# Interface: Logger

@totemsdk/pear — Logger

`createLogger(name)` returns a simple logger that routes output to:
  - Pear's built-in debug channel (`globalThis.Pear.debug`) when running
    inside a Pear app
  - `globalThis.console` (stderr on Node.js/Bare) otherwise

Bare-compatible: no `process.env`, no `__dirname`, no `require`.

## Methods

### debug()

> **debug**(`message`, ...`args`): `void`

#### Parameters

##### message

`string`

##### args

...`unknown`[]

#### Returns

`void`

***

### error()

> **error**(`message`, ...`args`): `void`

#### Parameters

##### message

`string`

##### args

...`unknown`[]

#### Returns

`void`

***

### info()

> **info**(`message`, ...`args`): `void`

#### Parameters

##### message

`string`

##### args

...`unknown`[]

#### Returns

`void`

***

### warn()

> **warn**(`message`, ...`args`): `void`

#### Parameters

##### message

`string`

##### args

...`unknown`[]

#### Returns

`void`
