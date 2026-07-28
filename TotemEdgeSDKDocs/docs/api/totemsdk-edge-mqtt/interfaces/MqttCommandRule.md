[**@totemsdk/edge-mqtt**](../index.md)

***

[@totemsdk/edge-mqtt](../index.md) / MqttCommandRule

# Interface: MqttCommandRule

## Extends

- [`MqttTopicRule`](MqttTopicRule.md)

## Properties

### allowedCommands?

> `optional` **allowedCommands?**: `string`[]

***

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

> **kind**: `"command"`

#### Overrides

[`MqttTopicRule`](MqttTopicRule.md).[`kind`](MqttTopicRule.md#kind)

***

### metadata?

> `optional` **metadata?**: `Record`\<`string`, `unknown`\>

#### Inherited from

[`MqttTopicRule`](MqttTopicRule.md).[`metadata`](MqttTopicRule.md#metadata)

***

### requiresPolicy?

> `optional` **requiresPolicy?**: `boolean`

***

### topicPattern

> **topicPattern**: `string`

#### Inherited from

[`MqttTopicRule`](MqttTopicRule.md).[`topicPattern`](MqttTopicRule.md#topicpattern)
