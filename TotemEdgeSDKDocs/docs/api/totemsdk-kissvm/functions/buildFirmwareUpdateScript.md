[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / buildFirmwareUpdateScript

# Function: buildFirmwareUpdateScript()

> **buildFirmwareUpdateScript**(`config`): `string`

Build the KISSVM firmware update script.

The script:
  1. Reads current version from PREVSTATE
  2. Validates new version > current version (no rollback)
  3. Verifies manufacturer signature over the firmware hash
  4. Verifies owner authorization via policy
  5. Preserves new version and hash in STATE

## Parameters

### config

[`FirmwareUpdateConfig`](../interfaces/FirmwareUpdateConfig.md)

## Returns

`string`
