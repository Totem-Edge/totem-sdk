[**@totemsdk/omnia-host**](../index.md)

***

[@totemsdk/omnia-host](../index.md) / createHostSigning

# Function: createHostSigning()

> **createHostSigning**(`config`): [`HostSigning`](../interfaces/HostSigning.md)

Derive the host's signing stack from config.

Throws when no key material is configured. Callers gate this behind
`config.readOnly` / key presence checks.

## Parameters

### config

[`OmniaHostConfig`](../interfaces/OmniaHostConfig.md)

## Returns

[`HostSigning`](../interfaces/HostSigning.md)
