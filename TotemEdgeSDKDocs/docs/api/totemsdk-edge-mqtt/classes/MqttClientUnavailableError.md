[**@totemsdk/edge-mqtt**](../index.md)

***

[@totemsdk/edge-mqtt](../index.md) / MqttClientUnavailableError

# Class: MqttClientUnavailableError

Typed error classes for @totemsdk/edge-mqtt.

Public methods prefer EdgeOperationResult where practical.
These errors are thrown only for programmer/configuration mistakes.

## Extends

- [`MqttEdgeError`](MqttEdgeError.md)

## Constructors

### Constructor

> **new MqttClientUnavailableError**(`message?`): `MqttClientUnavailableError`

#### Parameters

##### message?

`string` = `'MQTT client is not available'`

#### Returns

`MqttClientUnavailableError`

#### Overrides

[`MqttEdgeError`](MqttEdgeError.md).[`constructor`](MqttEdgeError.md#constructor)

## Properties

### code

> `readonly` **code**: `string`

#### Inherited from

[`MqttEdgeError`](MqttEdgeError.md).[`code`](MqttEdgeError.md#code)

***

### message

> **message**: `string`

#### Inherited from

[`MqttEdgeError`](MqttEdgeError.md).[`message`](MqttEdgeError.md#message)

***

### name

> **name**: `string`

#### Inherited from

[`MqttEdgeError`](MqttEdgeError.md).[`name`](MqttEdgeError.md#name)

***

### stack?

> `optional` **stack?**: `string`

#### Inherited from

[`MqttEdgeError`](MqttEdgeError.md).[`stack`](MqttEdgeError.md#stack)
