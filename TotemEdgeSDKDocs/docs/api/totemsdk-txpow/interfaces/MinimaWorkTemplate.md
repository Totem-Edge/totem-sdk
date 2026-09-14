[**@totemsdk/txpow**](../index.md)

***

[@totemsdk/txpow](../index.md) / MinimaWorkTemplate

# Interface: MinimaWorkTemplate

A Minima block-candidate work template.

This is the chain state a candidate is mined against. It is structurally
capable of becoming a legitimate Minima block: block number, block
difficulty, super-parents, MMR root/total, magic, and time are all taken
from the current chain tip (see TxPoWGenerator.generateTxPoW in Minima).

## Properties

### blockDifficulty

> **blockDifficulty**: `string`

Current block difficulty target (32-byte hex).

***

### blockNumber

> **blockNumber**: `bigint`

Block number = current tip + 1.

***

### capturedAt

> **capturedAt**: `number`

Epoch milliseconds when the template was captured.

***

### chainId

> **chainId**: `string`

Chain ID (MAIN_NET = 0x00).

***

### magic

> **magic**: `string`

Serialized Magic struct (hex).

***

### mmrRoot

> **mmrRoot**: `string`

Current MMR root (32-byte hex).

***

### mmrTotal

> **mmrTotal**: `bigint`

Current MMR total (sum of all coins).

***

### superParents

> **superParents**: `string`[]

Super-parent hashes at each cascade level (RLE-serialized).

***

### templateId

> **templateId**: `string`

Template identifier (e.g. tip txpowId) for staleness checks.

***

### timeMilli

> **timeMilli**: `bigint`

Candidate timestamp in epoch milliseconds.
