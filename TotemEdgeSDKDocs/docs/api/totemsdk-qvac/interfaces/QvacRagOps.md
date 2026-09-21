[**@totemsdk/qvac**](../index.md)

***

[@totemsdk/qvac](../index.md) / QvacRagOps

# Interface: QvacRagOps

## Properties

### ragChunk

> **ragChunk**: `QvacOp`\<[`RagChunkParams`](RagChunkParams.md), [`RagDoc`](RagDoc.md)[]\>

***

### ragCloseWorkspace

> **ragCloseWorkspace**: `QvacOp`\<[`RagCloseWorkspaceParams`](RagCloseWorkspaceParams.md), `void`\>

***

### ragDeleteEmbeddings

> **ragDeleteEmbeddings**: `QvacOp`\<[`RagDeleteEmbeddingsParams`](../type-aliases/RagDeleteEmbeddingsParams.md), `void`\>

***

### ragDeleteWorkspace

> **ragDeleteWorkspace**: `QvacOp`\<[`RagDeleteWorkspaceParams`](RagDeleteWorkspaceParams.md), `void`\>

***

### ragIngest

> **ragIngest**: `QvacOp`\<[`RagIngestParams`](RagIngestParams.md), \{ `droppedIndices`: `number`[]; `processed`: [`RagSaveEmbeddingsResult`](RagSaveEmbeddingsResult.md)[]; \}\>

***

### ragListWorkspaces

> **ragListWorkspaces**: `QvacOp`\<`Record`\<`string`, `never`\>, [`RagWorkspaceInfo`](RagWorkspaceInfo.md)[]\>

***

### ragReindex

> **ragReindex**: `QvacOp`\<[`RagReindexParams`](RagReindexParams.md), `RagReindexResult`\>

***

### ragSaveEmbeddings

> **ragSaveEmbeddings**: `QvacOp`\<[`RagSaveEmbeddingsParams`](RagSaveEmbeddingsParams.md), [`RagSaveEmbeddingsResult`](RagSaveEmbeddingsResult.md)[]\>

***

### ragSearch

> **ragSearch**: `QvacOp`\<[`RagSearchParams`](RagSearchParams.md), [`RagSearchResult`](RagSearchResult.md)[]\>
