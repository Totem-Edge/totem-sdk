[**@totemsdk/edge-mqtt**](../index.md)

***

[@totemsdk/edge-mqtt](../index.md) / matchMqttTopic

# Variable: matchMqttTopic

> `const` **matchMqttTopic**: (`pattern`, `topic`) => `any` = `match_mqtt_topic`

Match an MQTT topic pattern against a concrete topic.
Supports + (single-level) and # (multi-level, must be last segment).
Returns { matched: boolean, params: Record<string, string> }

## Parameters

### pattern

`string`

### topic

`string`

## Returns

`any`
