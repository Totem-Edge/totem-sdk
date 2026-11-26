[**@totemsdk/edge-ocpp**](../index.md)

***

[@totemsdk/edge-ocpp](../index.md) / encodeCallError

# Function: encodeCallError()

> **encodeCallError**(`messageId`, `errorCode`, `errorDescription`, `errorDetails?`): `string`

## Parameters

### messageId

`string`

### errorCode

`"NotSupported"` \| `"InternalError"` \| `"ProtocolError"` \| `"SecurityError"` \| `"FormationViolation"` \| `"PropertyConstraintViolation"` \| `"OccurrenceConstraintViolation"` \| `"TypeConstraintViolation"` \| `"GenericError"`

### errorDescription

`string`

### errorDetails?

`Record`\<`string`, `unknown`\> = `{}`

## Returns

`string`
