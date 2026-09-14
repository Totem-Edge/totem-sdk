[**@totemsdk/intelligence**](../index.md)

***

[@totemsdk/intelligence](../index.md) / INTELLIGENCE\_OPS

# Variable: INTELLIGENCE\_OPS

> `const` **INTELLIGENCE\_OPS**: `object`

Well-known operation identifiers per domain.
Callers may use any string — these are the canonical set shipped by @totemsdk/qvac.

## Type Declaration

### asr

> `readonly` **asr**: readonly \[`"transcribe"`, `"transcribeStream"`, `"bciTranscribe"`, `"bciTranscribeStream"`\]

### audiogen

> `readonly` **audiogen**: readonly \[`"audioGen"`\]

### classify

> `readonly` **classify**: readonly \[`"classify"`\]

### diffusion

> `readonly` **diffusion**: readonly \[`"diffusion"`, `"upscale"`\]

### embed

> `readonly` **embed**: readonly \[`"embed"`\]

### llm

> `readonly` **llm**: readonly \[`"completion"`, `"batchCompletion"`, `"finetune"`\]

### models

> `readonly` **models**: readonly \[`"loadModel"`, `"unloadModel"`, `"getModelInfo"`, `"getLoadedModelInfo"`, `"deleteCache"`, `"downloadAsset"`, `"assessModelFit"`, `"modelRegistryList"`, `"modelRegistrySearch"`, `"modelRegistryGetModel"`, `"suspend"`, `"resume"`, `"state"`\]

### ocr

> `readonly` **ocr**: readonly \[`"ocr"`\]

### plugins

> `readonly` **plugins**: readonly \[`"invokePlugin"`, `"invokePluginStream"`\]

### rag

> `readonly` **rag**: readonly \[`"ragChunk"`, `"ragIngest"`, `"ragSearch"`, `"ragSaveEmbeddings"`, `"ragDeleteEmbeddings"`, `"ragReindex"`, `"ragListWorkspaces"`, `"ragCloseWorkspace"`, `"ragDeleteWorkspace"`\]

### system

> `readonly` **system**: readonly \[`"heartbeat"`, `"getSystemResources"`, `"loggingStream"`, `"subscribeServerLogs"`, `"cancel"`, `"close"`\]

### translate

> `readonly` **translate**: readonly \[`"translate"`\]

### tts

> `readonly` **tts**: readonly \[`"textToSpeech"`, `"textToSpeechStream"`\]

### video

> `readonly` **video**: readonly \[`"video"`\]

### vla

> `readonly` **vla**: readonly \[`"vla"`, `"vlaHparams"`, `"vlaSetEmbodiment"`, `"vlaPreprocessImage"`, `"vlaPadState"`\]

### world

> `readonly` **world**: readonly \[`"worldCreateScene"`, `"worldStep"`\]
