[**@totemsdk/lookup-protocol**](../index.md)

***

[@totemsdk/lookup-protocol](../index.md) / checkVersion

# Function: checkVersion()

> **checkVersion**(`incomingVersion`): [`VersionCheckResult`](../interfaces/VersionCheckResult.md)

Check whether a received message's version is compatible with this build.
Returns compatible=true if versions match, or a structured VERSION_MISMATCH
error message otherwise.

## Parameters

### incomingVersion

`number`

## Returns

[`VersionCheckResult`](../interfaces/VersionCheckResult.md)
