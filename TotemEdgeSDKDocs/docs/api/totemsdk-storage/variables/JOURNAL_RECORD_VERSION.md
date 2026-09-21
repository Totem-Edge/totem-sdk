[**@totemsdk/storage**](../index.md)

***

[@totemsdk/storage](../index.md) / JOURNAL\_RECORD\_VERSION

# Variable: JOURNAL\_RECORD\_VERSION

> `const` **JOURNAL\_RECORD\_VERSION**: `2` = `2`

Current entry format version. 1 is the 2026 initial journal layout; set to 2
so that genuinely older journal formats can be demonstrated as
forward-migratable on read (migration is opt-in via `JournalOptions.migrate`).
