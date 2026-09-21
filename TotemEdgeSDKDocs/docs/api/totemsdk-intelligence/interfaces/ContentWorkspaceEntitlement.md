[**@totemsdk/intelligence**](../index.md)

***

[@totemsdk/intelligence](../index.md) / ContentWorkspaceEntitlement

# Interface: ContentWorkspaceEntitlement

A principal's entitlement to content. Content is addressed by workspace:
a principal may search/ingest/lifecycle exactly the workspaces listed, and
nothing else.

## Properties

### principal

> **principal**: `string`

Principal identifier (account, agent id, purchase key).

***

### workspaceIds

> **workspaceIds**: readonly `string`[]

Workspace ids the principal may read and write.
