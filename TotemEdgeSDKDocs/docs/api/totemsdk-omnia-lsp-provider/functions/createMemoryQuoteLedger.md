[**@totemsdk/omnia-lsp-provider**](../index.md)

***

[@totemsdk/omnia-lsp-provider](../index.md) / createMemoryQuoteLedger

# Function: createMemoryQuoteLedger()

> **createMemoryQuoteLedger**(): [`OmniaLspQuoteLedger`](../interfaces/OmniaLspQuoteLedger.md)

Default in-process ledger.

Single-threaded JS makes the check-and-set inside `consume` atomic for one
process. It does not survive a restart — inject a durable ledger for that.

## Returns

[`OmniaLspQuoteLedger`](../interfaces/OmniaLspQuoteLedger.md)
