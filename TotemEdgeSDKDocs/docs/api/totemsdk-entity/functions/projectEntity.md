[**@totemsdk/entity**](../index.md)

***

[@totemsdk/entity](../index.md) / projectEntity

# Function: projectEntity()

> **projectEntity**(`resolution`, `request?`): [`EntityView`](../interfaces/EntityView.md)

Produce a disclosure-bounded view from a resolved entity.

Default mode is `minimal` (no sections). `available` discloses every verified
section up to `maxDisclosureLevel`. `purpose-bound` discloses only the
sections required by the requested purposes.

## Parameters

### resolution

[`EntityResolution`](../interfaces/EntityResolution.md)

### request?

[`EntityProjectionRequest`](../interfaces/EntityProjectionRequest.md) = `{}`

## Returns

[`EntityView`](../interfaces/EntityView.md)
