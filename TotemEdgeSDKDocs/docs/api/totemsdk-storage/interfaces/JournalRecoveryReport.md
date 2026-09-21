[**@totemsdk/storage**](../index.md)

***

[@totemsdk/storage](../index.md) / JournalRecoveryReport

# Interface: JournalRecoveryReport

## Properties

### gapAt

> `readonly` **gapAt**: readonly `number`[]

seqs missing below the contiguous tail — corruption the journal refuses.

***

### headAfter

> `readonly` **headAfter**: `number`

Highest contiguous durably-recorded sequence.

***

### headBefore

> `readonly` **headBefore**: `number`

Head before `recover()` ran (may already equal `headAfter`).

***

### repairedUnrecordedTail

> `readonly` **repairedUnrecordedTail**: `boolean`

True when an unrecorded tail was rolled back (crash between bump+write).
