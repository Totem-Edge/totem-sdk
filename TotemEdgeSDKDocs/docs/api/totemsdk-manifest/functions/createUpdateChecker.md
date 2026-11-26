[**@totemsdk/manifest**](../index.md)

***

[@totemsdk/manifest](../index.md) / createUpdateChecker

# Function: createUpdateChecker()

> **createUpdateChecker**(`options?`): [`UpdateChecker`](../interfaces/UpdateChecker.md)

Awareness-only periodic check. It never installs, blocks, degrades or mutates
package state: it evaluates a feed and reports. Safe to embed in any SDK
runtime, including long-lived edge adapters.

## Parameters

### options?

[`UpdateCheckerOptions`](../interfaces/UpdateCheckerOptions.md) = `{}`

## Returns

[`UpdateChecker`](../interfaces/UpdateChecker.md)
