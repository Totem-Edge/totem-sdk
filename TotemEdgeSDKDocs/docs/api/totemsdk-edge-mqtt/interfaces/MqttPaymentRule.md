[**@totemsdk/edge-mqtt**](../index.md)

***

[@totemsdk/edge-mqtt](../index.md) / MqttPaymentRule

# Interface: MqttPaymentRule

## Extends

- [`MqttTopicRule`](MqttTopicRule.md)

## Properties

### enabled?

> `optional` **enabled?**: `boolean`

#### Inherited from

[`MqttTopicRule`](MqttTopicRule.md).[`enabled`](MqttTopicRule.md#enabled)

***

### id

> **id**: `string`

#### Inherited from

[`MqttTopicRule`](MqttTopicRule.md).[`id`](MqttTopicRule.md#id)

***

### kind

> **kind**: `"payment"`

#### Overrides

[`MqttTopicRule`](MqttTopicRule.md).[`kind`](MqttTopicRule.md#kind)

***

### metadata?

> `optional` **metadata?**: `Record`\<`string`, `unknown`\>

#### Inherited from

[`MqttTopicRule`](MqttTopicRule.md).[`metadata`](MqttTopicRule.md#metadata)

***

### paymentRequired?

> `optional` **paymentRequired?**: `boolean`

***

### price?

> `optional` **price?**: `string`

***

### tokenId?

> `optional` **tokenId?**: `string`

***

### topicPattern

> **topicPattern**: `string`

#### Inherited from

[`MqttTopicRule`](MqttTopicRule.md).[`topicPattern`](MqttTopicRule.md#topicpattern)
