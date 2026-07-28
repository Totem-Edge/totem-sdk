[**@totemsdk/edge-mqtt**](../index.md)

***

[@totemsdk/edge-mqtt](../index.md) / MqttEdgeError

# Class: MqttEdgeError

Typed error classes for @totemsdk/edge-mqtt.

Public methods prefer EdgeOperationResult where practical.
These errors are thrown only for programmer/configuration mistakes.

## Extends

- `Error`

## Extended by

- [`MqttClientUnavailableError`](MqttClientUnavailableError.md)
- [`MqttPolicyRejectedError`](MqttPolicyRejectedError.md)
- [`MqttPaymentRequiredError`](MqttPaymentRequiredError.md)
- [`MqttCreditExceededError`](MqttCreditExceededError.md)
- [`MqttProofCreationError`](MqttProofCreationError.md)
- [`MqttQueueError`](MqttQueueError.md)

## Constructors

### Constructor

> **new MqttEdgeError**(`message`, `code?`): `MqttEdgeError`

#### Parameters

##### message

`string`

##### code?

`string` = `'MQTT_EDGE_ERROR'`

#### Returns

`MqttEdgeError`

#### Overrides

`Error.constructor`

## Properties

### code

> `readonly` **code**: `string`

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
