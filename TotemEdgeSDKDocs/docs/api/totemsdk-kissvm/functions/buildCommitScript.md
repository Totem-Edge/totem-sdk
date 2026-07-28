[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / buildCommitScript

# Function: buildCommitScript()

> **buildCommitScript**(`config`): `string`

Build a commit script that verifies:
  1. The commitment hash matches the config
  2. Nonce increases monotonically

Port layout:
  commitmentPort — pre-computed SHA3 commit
  noncePort — monotonic counter

## Parameters

### config

[`CommitConfig`](../interfaces/CommitConfig.md)

## Returns

`string`
