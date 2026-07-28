**Edition:** 1.0  
**Source snapshot:** `minima-global/Minima` commit `74316b11b6ce724f36ff757ad30113f2dcc04990`  
**Prepared:** 2026-07-26

> Engineering reference, not an audit or financial/legal advice. Templates require adaptation and independent review.

---

## How to use this guide

Read Chapters 1-10 before writing a stateful or value-bearing contract. Use Chapters 15-17 as the build loop, Chapters 18-20 for patterns, and the appendices during implementation and review. The standalone template files are intentionally comment-free; their rationale and test notes live here and in the library README.

## Contents

- 1. Purpose, scope, and source snapshot

- 2. Runtime architecture and execution lifecycle

- 3. Lexical rules and source formatting

- 4. Values and type discipline

- 5. Variables, tuple arrays, and state schema

- 6. Operators and precedence

- 7. Statements and control flow

- 8. Global execution context

- 9. Signatures and authorization

- 10. Transaction introspection and covenants

- 11. Hashes, commitments, MMR proofs, and MAST

- 12. Data, strings, bytes, and bitfields

- 13. Dynamic scripts and metaprogramming

- 14. Monotonicity, timing, and lifecycle safety

- 15. Testing with runscript

- 16. Security review methodology

- 17. Builder workflow from idea to deployment

- 18. Worked example: repository Bonds script

- 19. Worked example: repository Lotto commit-reveal

- 20. Pattern library and adaptation notes

- 21. Debugging guide

- 22. Production readiness checklist

- 23. Source map and versioning

- Appendix A. Complete built-in function catalog

- Appendix B. Template inventory and test cookbook

- Appendix C. Glossary

---

# 1. Purpose, scope, and source snapshot

This handbook is a source-anchored field guide to KISSVM, the smart-contract virtual machine embedded in Minima. It is written for builders who need more than syntax: a mental model, exact runtime boundaries, a disciplined testing method, reusable patterns, adversarial review guidance, and a template library that can be adapted to real transactions.

**Primary implementation snapshot:** `minima-global/Minima` on `master`, commit `74316b11b6ce724f36ff757ad30113f2dcc04990`. The authoritative function registry in `src/org/minima/kissvm/functions/MinimaFunction.java` contains 53 built-ins in this snapshot. The core execution path is `Contract` -> `ScriptTokenizer` -> `StatementParser` / `ExpressionParser` -> `StatementBlock`.

This is not an audit report and the included templates are not production approvals. Treat every deployment as a new security boundary. Exact transaction construction, wallet signing, token metadata and network policy are partly implemented outside `src/org/minima/kissvm`; those integrations are explained where they affect contract behavior.

### What "KISSVM contract" means

KISSVM is best understood as a **spend validator for a UTXO coin**, not a persistent account-style object. A coin is locked to an address derived from a script. When a transaction spends that coin, the node evaluates the script against the spending transaction, witness material, signatures, previous state and global context. A successful Boolean return authorizes that input; a parse error, execution error, failed assertion or false return rejects it.

That model leads to the most important design rule in this guide:

> Design the next valid transaction, not merely the current authorization condition.

A robust contract constrains outputs, state continuity, token identity, amounts and transaction shape-not only who signed.

# 2. Runtime architecture and execution lifecycle

A KISSVM execution follows a deterministic pipeline:

1. **Context creation.** The VM receives the RAM script, the transaction, witness, a list of signature keys and previous state variables.
2. **Tokenization.** `ScriptTokenizer` classifies commands, functions, operators, values, globals and variables.
3. **Statement parsing.** `StatementParser` builds blocks for `LET`, `IF`, `WHILE`, `ASSERT`, `RETURN`, `EXEC` and `MAST`.
4. **Expression parsing.** `ExpressionParser` applies fixed precedence and creates expression nodes.
5. **Execution.** `StatementBlock` executes statements in order, charges instructions and stops as soon as a return value has been set.
6. **Result.** The result records parse status, exceptions, success, instruction count, monotonicity, variables and trace.

### Consensus-relevant limits in the snapshot

| Limit | Value | Design implication |
|---|---:|---|
| Maximum VM instructions | 1,024 | Leave headroom; loops and explicit signature checks can consume it quickly. |
| Maximum stack depth | 64 | Deeply nested expressions, blocks, dynamic functions and MAST leaves can fail. |
| Maximum function parameters | 32 | Large allowlists should use proofs, state or structured data-not a giant call. |
| Maximum string/hex value | 64 KiB | Bound concatenation, replacements, dynamic scripts and witness data. |
| Maximum bit shift | 256 | Reject or normalize externally supplied shift counts. |

`CHECKSIG` adds 31 extra units in addition to the ordinary statement/function work, making its effective explicit charge 32. Resource use should be tested on every branch, especially the longest failure path.

### Parse failure versus execution failure

A parse failure means the script never becomes an executable statement tree. An execution failure occurs after parsing and automatically sets the result to false. Examples include missing state, wrong value type, out-of-range input/output indexes, missing array entries, oversized data, invalid proof encoding and instruction exhaustion.

# 3. Lexical rules and source formatting

KISSVM is intentionally small and strict.

- Commands and built-ins are uppercase in raw VM source: `LET`, `RETURN`, `SIGNEDBY`.
- User variable names are lowercase letters only and are capped at 32 characters.
- Globals are uppercase names prefixed by `@`, such as `@AMOUNT`.
- Number literals are unsigned decimal forms at tokenization; a leading minus is parsed as negation/negative number syntax.
- Hex literals begin with `0x` and contain hexadecimal digits.
- Script/string values use square brackets: `[RETURN TRUE]`. Nested square brackets are tokenized as one value.
- Function arguments are whitespace-separated, not comma-separated: `VERIFYOUT(0 addr amount token TRUE)`.
- A space is required before command words in raw tokenization. Use the cleaned script returned by tooling as the canonical deployment text.

Repository MiniDapp examples contain block comments and the Script IDE/tooling may preprocess them. For portable contract artifacts, keep the deployed `.kiss` source comment-free and put explanations beside it in Markdown. This prevents a documentation comment from accidentally becoming part of address derivation or raw parsing.

### Canonicalization and addresses

Script addresses depend on exact script content. The `runscript` command returns both the original and cleaned script with their respective addresses. A builder should:

1. maintain a readable source file;
2. run it through the node cleaner;
3. record the cleaned script, hash/address and commit ID together;
4. deploy only the recorded cleaned form;
5. re-run tests against that exact cleaned form.

# 4. Values and type discipline

KISSVM has four value types:

| Type | Literal / origin | Core use |
|---|---|---|
| `BOOLEAN` | `TRUE`, `FALSE`, comparisons | Conditions and `RETURN`. |
| `NUMBER` | `12`, `0.25`, `-4` | Amounts, indexes, counters and arithmetic. |
| `HEX` | `0xAABB` | Keys, addresses, token IDs, hashes, signatures and bytes. |
| `SCRIPT` | `[text or KISSVM]` | Text, dynamic scripts and function bodies. |

Functions generally enforce exact types rather than silently coercing. Use explicit casts at trust boundaries.

### Conversion traps

- `BOOL(number)` is false only for zero.
- `BOOL(hex)` converts the data value to a number and tests non-zero.
- `BOOL(script)` is false only when its exact text is `FALSE`; an empty script and `[0]` are true.
- `HEX(number)` accepts only a non-negative whole number.
- `NUMBER(hex)` interprets the hex data as a positive numeric value.
- `LEN(hex)` counts bytes; `LEN(script)` counts Java string characters, not UTF-8 bytes.
- `ASCII(hex)` and `UTF8(hex)` decode with different charsets. Hash the original bytes when byte identity matters.

### Equality and ordering

Treat comparison as strongly typed. Do not rely on a cast being inferred. A safe pattern is:

```kissvm
LET candidate = STATE(0)
ASSERT HEX(candidate) EQ candidate
ASSERT LEN(candidate) EQ 32
```

The first assertion proves that the state value is already a hex value; the second constrains its exact byte width.

# 5. Variables, tuple arrays, and state schema

Simple variables use `LET name = expression`. Tuple-indexed variables create an in-memory array/map:

```kissvm
LET (0) = 0xAA
LET (1 7) = 42
ASSERT EXISTS(1 7)
LET answer = GET(1 7)
```

Internally the numeric indexes are joined into a composite key. `GET` throws when an entry is absent, so use `EXISTS` before retrieving untrusted or sparse entries.

### State is transaction data, not mutable VM memory

- `STATE(port)` reads the current transaction state.
- `PREVSTATE(port)` reads state attached to the spent input coin.
- `SAMESTATE(start end)` compares an inclusive port range.

A state-machine transition is therefore a comparison between old and new transaction data. Recommended schema practices:

1. reserve and document port ranges;
2. keep a schema version port;
3. assign one purpose and one type to each port;
4. explicitly preserve immutable ranges with `SAMESTATE`;
5. explicitly validate every mutable port;
6. reject unknown versions;
7. never assume a missing port becomes zero-missing state throws.

Example schema:

| Ports | Meaning | Policy |
|---|---|---|
| 0 | schema version | Immutable. |
| 1 | transition nonce | Must increment by one. |
| 2 | owner key | Immutable or governed by a rotation branch. |
| 3-9 | contract configuration | Usually immutable. |
| 10-31 | application state | Validated per transition. |
| 100+ | recovery / administrative data | Isolated from application state. |

# 6. Operators and precedence

From lowest to highest binding in the implementation:

1. Boolean combinators: `AND`, `OR`, `XOR`, `NAND`, `NOR`, `NXOR`
2. Relations: `EQ`, `NEQ`, `GT`, `GTE`, `LT`, `LTE`
3. Bitwise: `&`, `|`, `^`
4. Additive / modulo / shift: `+`, `-`, `%`, `<<`, `>>`
5. Multiplicative: `*`, `/`
6. Unary: `NOT`, `NEG`, `~`
7. Literals, globals, variables, function calls and parenthesized expressions

The safest review style is to parenthesize mixed relational and Boolean logic even when precedence is known:

```kissvm
ASSERT (odds GT 0) AND (odds LT 1)
```

`NEG` is Boolean negation in the token set's naming, while unary minus handles negative numbers and `~` is bitwise complement. Test each unary operator against the exact value type you intend.

### Numeric safety

- Validate divisors before division or modulo.
- Bound exponents, shifts, loop counters and calculated indexes.
- Calculate token amounts in scaled units, because amount accessors and verifiers scale non-Minima token amounts.
- Avoid equality on computed decimal values unless the construction is exact and tested. Prefer inequalities with documented rounding rules.

# 7. Statements and control flow

### LET

Assign a variable or tuple-array entry. `LET` expressions extend until the next command token, so a missing command boundary can produce surprising parse errors.

### ASSERT

Evaluate a Boolean condition. False or non-Boolean behavior rejects execution. `ASSERT` is the preferred way to encode mandatory invariants because it makes fail-closed intent obvious.

### RETURN

`RETURN` requires a Boolean. The first return value wins; once set, enclosing blocks stop before later statements. Never place a required check after a branch that can return.

### IF / ELSEIF / ELSE / ENDIF

Each condition is an expression followed by a nested statement block. Prefer mutually exclusive, named phases over deeply nested condition trees.

### WHILE / DO / ENDWHILE

Loops are legal but bounded by the 1,024-instruction budget. Every loop needs a reviewable variant:

- explicit initialization;
- monotonic counter update;
- hard upper bound derived from trusted data;
- no unbounded growth of strings or hex;
- failure tests at the maximum boundary.

### EXEC

Evaluates a script value, tokenizes it and executes it in the same contract context. Dynamic code must be authenticated-typically by comparing its hash to immutable previous state-before execution.

### MAST

Takes a hex hash, retrieves the corresponding script proof from the witness and executes the revealed leaf. This enables hidden branches and compact root commitments, but the leaf still shares stack and instruction constraints.

# 8. Global execution context

The standard `Contract.setGlobals` path sets these globals:

| Global | Meaning |
|---|---|
| `@BLOCK` | Current block number. |
| `@BLOCKMILLI` | Current block timestamp in milliseconds. |
| `@CREATED` | Input coin creation block. |
| `@COINAGE` | `@BLOCK - @CREATED`. |
| `@INPUT` | Index of the input currently being validated. |
| `@COINID` | Current input coin ID. |
| `@AMOUNT` | Current input amount, scaled for tokens. |
| `@ADDRESS` | Current input address. |
| `@TOKENID` | Current input token ID. |
| `@SCRIPT` | Current script text. |
| `@TOTIN` | Total transaction inputs. |
| `@TOTOUT` | Total transaction outputs. |

Accessing `@BLOCK`, `@BLOCKMILLI` or `@COINAGE` marks a contract non-monotonic in the current implementation. This is not the same as invalidity; it is metadata used by the system. Time-dependent contracts should document why they are non-monotonic and test boundary blocks/timestamps.

### Index discipline

`@INPUT` is the current input index, not automatically an output index. Repository scripts sometimes intentionally recreate output `@INPUT`, but that is a transaction layout convention. Enforce `@TOTIN`, `@TOTOUT` and every relevant indexed tuple when output position is security-critical.

# 9. Signatures and authorization

KISSVM exposes two signature models.

### Transaction signature-key membership

`SIGNEDBY(pubkey)` checks whether that key is present in the signature-key list supplied to the contract. `MULTISIG(required keys...)` counts matching listed keys and succeeds once the threshold is reached.

Use these for normal transaction authorization:

```kissvm
RETURN MULTISIG(2 0xAA 0xBB 0xCC)
```

Review points:

- reject negative thresholds (the function does);
- ensure the threshold is not trivially zero unless that is intentionally public spend;
- avoid duplicate keys in the policy list;
- test all threshold combinations;
- remember that test harness "signatures" are key identifiers for membership simulation.

### Explicit cryptographic verification

`CHECKSIG(pubkey data signature)` parses a serialized signature and verifies it against arbitrary data. It has a higher instruction charge and rejects zero-length key/signature parameters.

Use it for oracle attestations, off-chain authorizations or protocol messages only after defining a domain-separated message format. Bind at least:

- protocol name and version;
- network/chain identifier where applicable;
- contract address or policy hash;
- nonce or expiry;
- exact action and parameters.

Never verify a signature over an ambiguous concatenation of variable-length fields.

# 10. Transaction introspection and covenants

KISSVM can inspect indexed inputs and outputs and can sum amounts by token ID. The strongest primitives are exact tuple verifiers:

```kissvm
VERIFYIN(index address amount tokenid)
VERIFYOUT(index address amount tokenid [keepstate])
```

For non-Minima tokens, amount accessors and verifiers use scaled token amounts. This is convenient for contract arithmetic but makes token metadata part of your unit model.

### Covenant construction checklist

1. Constrain `@TOTIN` and `@TOTOUT` when extra inputs/outputs would change meaning.
2. Verify every security-relevant output by index.
3. Verify token ID before applying amount logic.
4. Decide whether the successor output must keep state.
5. Ensure change and fee behavior cannot bypass an invariant.
6. Avoid using only `SUMOUTPUTS`; a correct total can still be distributed to malicious addresses.
7. Avoid using only an address check; the amount or token can be wrong.
8. Test output reordering, duplicate outputs and an extra dust output.

### Self-recreating stateful coin

```kissvm
ASSERT @TOTIN EQ 1
ASSERT @TOTOUT EQ 1
ASSERT STATE(0) EQ INC(PREVSTATE(0))
RETURN VERIFYOUT(0 @ADDRESS @AMOUNT @TOKENID TRUE)
```

This constrains shape, state transition, address, amount, token and state retention.

# 11. Hashes, commitments, MMR proofs, and MAST

`SHA2` and `SHA3` accept hex bytes or script bytes and return hex. Always define which representation is committed. `SHA3(0x4142)` and `SHA3([AB])` may be equal only if the script byte encoding exactly matches those two bytes; do not assume cross-type equivalence without a test.

### Commit-reveal

A standard pattern stores a hash in previous state and reveals the preimage in current state:

```kissvm
LET preimage = STATE(9)
ASSERT SHA3(preimage) EQ PREVSTATE(2)
```

Bind commitments to context when replay matters, for example by hashing a concatenation containing a contract-specific nonce or coin ID.

### MMR proof verification

`PROOF(data leafsum roothash rootsum proofchain)` reconstructs an MMR root from the leaf and serialized proof, then compares both hash and sum. Invalid proof serialization throws. Validate the type/size of all externally provided proof fields before calling it where practical.

### MAST

MAST keeps inactive branches out of the visible locking script. The root commits to possible leaf scripts, and the witness reveals the selected leaf plus proof. Benefits include privacy and smaller main scripts; risks include untested hidden branches, proof construction errors and branch-specific resource exhaustion. Maintain a manifest of every leaf, its cleaned script, hash, tests and intended authorization path.

# 12. Data, strings, bytes, and bitfields

KISSVM provides byte operations (`CONCAT`, `SUBSET`, `OVERWRITE`, `REV`, `SETLEN`) and string operations (`SUBSTR`, `REPLACE`, `REPLACEFIRST`). These are powerful enough to build structured messages and compact permissions, but representation mistakes are common.

### Byte-range conventions

- `SUBSET(start end hex)` uses a half-open range `[start,end)`.
- `OVERWRITE(src srcpos dest destpos len)` copies exactly `len` bytes into a cloned destination.
- Bounds violations throw.
- `BITGET` / `BITSET` use Java `BitSet.valueOf(byte[])`; establish test vectors rather than reading visual hex from left to right.
- `BITSET` converts back with `toByteArray`, which can compact zero high-order bytes. Use `SETLEN` after bit mutation when fixed width is part of the protocol.

### Safe structured message pattern

Prefer fixed-width fields:

```kissvm
LET version = SETLEN(1 HEX(1))
LET nonce = SETLEN(8 HEX(STATE(0)))
LET amount = SETLEN(16 HEX(STATE(1)))
LET message = CONCAT(version nonce amount @TOKENID @ADDRESS)
```

Before converting numbers to hex, assert they are whole and non-negative through application invariants.

# 13. Dynamic scripts and metaprogramming

KISSVM supports three advanced composition mechanisms:

- `FUNCTION(script args...)` performs textual `$1`, `$2`, ... replacement, executes the resulting script and returns variable `returnvalue` if set.
- `EXEC script` executes a script value directly.
- `MAST hash` executes a witness-proven script leaf.

### Function hygiene

A function body returns a value by assigning `returnvalue`:

```kissvm
LET body = [LET returnvalue = $1 GTE $2]
LET ok = FUNCTION(body @AMOUNT 10)
RETURN ok
```

Textual replacement can create syntax or type confusion. Keep function bodies immutable, pass typed values, avoid putting untrusted script text into placeholders and test the final substituted text.

### Authenticated EXEC

```kissvm
LET candidate = STATE(0)
ASSERT SHA3(candidate) EQ PREVSTATE(0)
EXEC candidate
RETURN FALSE
```

The trailing false is defensive: the executed code must explicitly authorize. Note that an executed `RETURN` exits the overall contract because it sets the shared result.

# 14. Monotonicity, timing, and lifecycle safety

A contract is marked non-monotonic when it reads `@BLOCK`, `@BLOCKMILLI` or `@COINAGE`. The practical design concern is that validity can change as chain context advances.

### Timing rules

- Prefer block height or coin age when protocol logic is block-oriented.
- Use timestamp only when real-world time is indispensable.
- Decide whether the boundary is inclusive (`GTE`) or exclusive (`GT`).
- Test the value immediately before, at and immediately after the boundary.
- Define a timeout branch that cannot be blocked by the counterparty.
- Ensure a recovery path does not accidentally bypass output/state constraints.

### State-machine lifecycle

Every phase should specify:

1. who may transition;
2. required previous phase and nonce;
3. permitted next phase(s);
4. exact outputs and state retention;
5. timeout/recovery behavior;
6. terminal conditions;
7. replay resistance.

# 15. Testing with runscript

The node's `runscript` command is the primary unit-test harness. It accepts:

- `script` - contract source;
- `state` - current state object;
- `prevstate` - previous state object;
- `globals` - global values;
- `signatures` - simulated signature-key set;
- `extrascripts` - MAST script/proof material.

The response includes original and cleaned scripts/addresses, trace, variables, parse status, monotonicity and success.

### Minimal test cycle

```text
runscript script:"RETURN SIGNEDBY(0xAA)" signatures:["0xAA"]
runscript script:"RETURN SIGNEDBY(0xAA)" signatures:["0xBB"]
```

### Required test matrix

For each contract branch, include:

- one positive test;
- wrong signer / missing signer;
- wrong type;
- missing state;
- prior/current state mismatch;
- minimum and maximum numeric boundaries;
- wrong token ID;
- wrong amount;
- output reordered;
- extra input and output;
- keep-state flipped;
- instruction/loop maximum;
- malformed proof/signature/dynamic script;
- cleaned-script address snapshot.

Record `parseok`, `success`, `monotonic`, instruction count/trace and cleaned address as test artifacts. A passing Boolean alone is insufficient.

# 16. Security review methodology

Review a KISSVM contract in five passes.

### Pass 1 - Authorization

Map every successful return to the exact signer/proof/secret condition. Look for zero-threshold multisig, duplicated keys, public branches and recovery shortcuts.

### Pass 2 - Asset conservation and destinations

For every successful branch, list all allowed outputs by index, address, amount, token and keep-state. Test extra and reordered outputs.

### Pass 3 - State transition

Create a table of every port: previous value, proposed value and invariant. Missing checks are findings, not assumptions.

### Pass 4 - Time and replay

Examine block/coinage boundaries, commitment domain separation, nonces, coin IDs, reusable oracle messages and stale states.

### Pass 5 - Parser, type and resource behavior

Check case/spacing, type casts, missing entries, byte ranges, dynamic code, maximum data, loop termination, stack depth and expensive signature/proof branches.

### Fail-closed standard

A good script has one obvious default: false. Successful branches are narrow and fully constrained. Prefer:

```kissvm
ASSERT mandatorycondition
ASSERT exactoutputcondition
RETURN exactauthorization
```

over broad Boolean expressions that mix policy, arithmetic and authorization in one line.

# 17. Builder workflow from idea to deployment

1. **Write the transaction invariant in prose.** State what must be true about inputs, outputs, state and authorization.
2. **Define units and representations.** Token scaling, byte widths, hash inputs and state types.
3. **Create a state-port schema.** Reserve version, nonce, keys, config and mutable application ranges.
4. **Draw the state machine.** Include timeout and terminal transitions.
5. **Write the smallest successful branch.** Add exact covenants before convenience logic.
6. **Add negative tests first.** Try extra outputs, wrong indexes and stale state.
7. **Measure the longest path.** Leave instruction and stack headroom.
8. **Canonicalize.** Store cleaned script and address together.
9. **Peer review using the checklist.** Reviewer should reconstruct the allowed transaction set independently.
10. **Stage with non-critical value.** Observe real transaction construction and state behavior.
11. **Freeze artifacts.** Source, cleaned script, address, tests, state schema and template parameters.
12. **Monitor and document recovery.** Operational procedures are part of contract safety.

### Builder heuristics

- Constrain transaction shape early.
- Keep signer checks near the end, after asset/state invariants.
- Use named variables for every state port and computed amount.
- Use `SAMESTATE` for ranges, then separately validate mutable ports.
- Prefer a proof/MAST allowlist to a large inline key list.
- Treat `EXEC` and `FUNCTION` as code generation, not ordinary data handling.
- Maintain at least 20% instruction headroom on the worst measured branch.

# 18. Worked example: repository Bonds script

The repository's `mds/code/bonds/script.txt` demonstrates a practical offer/covenant pattern.

### Structure

1. Previous-state port 100 contains an emergency key. Its signature immediately authorizes an escape.
2. Previous ports configure maximum block, payout address, maximum coinage and desired rate.
3. Current state carries future-cash terms.
4. Assertions require rate equality, correct payout address and bounded timing.
5. The required output amount is calculated as `@AMOUNT * rate`.
6. `VERIFYOUT(@INPUT ... TRUE)` requires an indexed output at a fixed contract address with the calculated amount, same token and keep-state enabled.

### What it teaches

- Configuration belongs in previous state when the spender must not alter it.
- Escape paths should be deliberate and visibly placed before normal covenants.
- Every quoted offer property is checked, not inferred.
- Output index conventions are protocol assumptions and should be documented.
- A recovery signature bypasses the normal payout logic; governance must decide whether that power is acceptable.

### Hardening questions

- Should the emergency path also constrain destination or require a delay?
- Should `@TOTIN` / `@TOTOUT` be fixed?
- Is multiplication exact for every supported token scale?
- Can a malicious transaction exploit another input/output at the same index convention?
- Are all state ports type- and range-checked?

# 19. Worked example: repository Lotto commit-reveal

The repository Lotto script is a multi-round state machine.

- Round increments by one from previous state.
- Player and operator keys, commitment, odds, payout address, game ID and fee are stored in previous state.
- Round 1 allows a player cancellation after a coin-age timeout or an operator-signed transition that preserves ports 1-7 and adds random commitment data.
- Round 2 allows operator timeout recovery or player reveal.
- The reveal is hashed and compared with the stored commitment.
- A combined hash of the reveal and operator randomness is sliced, converted to a number and compared with a probability-derived target.
- Winner and loser branches route funds differently.

### Review insights

This is an excellent teaching example because it combines state continuity, timeout branches, hash commitments, byte slicing, numeric conversion, probability arithmetic and exact output covenants. It also illustrates why economic/probabilistic contracts require tests beyond VM correctness: fairness depends on who commits first, how randomness is selected, whether either party can abort selectively and how decimal odds are rounded.

# 20. Pattern library and adaptation notes

The accompanying `templates/` directory contains 24 patterns. They are intentionally small and composable. Before adapting one:

- replace demonstration keys, addresses, token IDs, amounts, heights and state ports;
- decide transaction shape and output indexes;
- add a schema/version check;
- add positive and negative `runscript` tests;
- confirm the cleaned script address;
- perform an independent security review.

Patterns include single signature, threshold multisig, absolute and relative timelocks, HTLC, escrow, state counter, immutable state, token gate, exact payout, split payment, self-recreating covenant, bounded withdrawal, nonce authorization, bitfield permissions, dynamic function, authenticated `EXEC`, MAST dispatch, explicit oracle signature, MMR proof, tuple-array allowlist, selected-state preservation, emergency escape and commit-reveal rounds.

# 21. Debugging guide

### Parse errors

Check command/function case, required spaces before commands, missing parentheses, incorrect function arity, invalid variable names and malformed hex. Start with the cleaned script returned by `runscript`.

### "Global not found"

The test harness did not receive the global or the on-chain execution path does not define it. Use only globals guaranteed by the actual Contract setup.

### State missing

`STATE` and `PREVSTATE` do not default. Supply exact ports in tests and transaction construction.

### Wrong parameter type

Inspect the trace and add explicit `HEX`, `NUMBER`, `BOOL` or `STRING` conversions only after validating the conversion domain.

### Output/input out of range

The indexed function is strict. Test `@TOTIN` / `@TOTOUT`, then inspect actual transaction ordering.

### Correct logic, wrong address

Canonical source differs. Compare original and cleaned scripts, whitespace/case and embedded script values.

### Instruction exhaustion

Use trace to identify the longest branch, loops, repeated data operations and `CHECKSIG`. Refactor or move large membership checks into a proof.

### Dynamic script failure

Log the final substituted/executed script in an off-chain test tool. Verify type-safe substitution, brackets, command spacing, stack depth and authenticated hash.

# 22. Production readiness checklist

- [ ] Snapshot commit and node version recorded.
- [ ] Cleaned script and address recorded.
- [ ] State schema documented with types and ownership.
- [ ] Every successful branch mapped.
- [ ] Every branch constrains required outputs.
- [ ] `@TOTIN` / `@TOTOUT` policy explicit.
- [ ] Token scaling and decimal rounding documented.
- [ ] Previous/current state transitions complete.
- [ ] Timeout boundaries tested before/at/after.
- [ ] Replay/domain separation addressed.
- [ ] Dynamic code authenticated or absent.
- [ ] MAST leaf manifest complete.
- [ ] Loop bounds and maximum instruction trace recorded.
- [ ] Stack/data/function-parameter limits considered.
- [ ] Wrong-type and missing-state tests present.
- [ ] Output reorder / extra-output tests present.
- [ ] Recovery path reviewed as a separate security policy.
- [ ] Independent reviewer reproduced the allowed transaction set.
- [ ] Staged deployment completed with disposable value.
- [ ] Operational recovery and monitoring procedure documented.

# 23. Source map and versioning

The implementation surface used by this handbook is organized as follows:

- `src/org/minima/kissvm/Contract.java` - context, globals, limits, trace, state access and result.
- `src/org/minima/kissvm/tokens/` - script and lexical tokens.
- `src/org/minima/kissvm/expressions/` - constants, variables, globals, functions, Boolean and numeric operators, precedence.
- `src/org/minima/kissvm/statements/` - block parser and statement execution.
- `src/org/minima/kissvm/statements/commands/` - `LET`, `IF`, `WHILE`, `ASSERT`, `RETURN`, `EXEC`, `MAST`.
- `src/org/minima/kissvm/values/` - Boolean, number, hex and script/string value classes.
- `src/org/minima/kissvm/functions/` - authoritative built-in registry and implementations.
- `src/org/minima/system/commands/scripts/runscript.java` - test harness.
- `mds/code/bonds/script.txt` - real repository covenant example.
- `mds/code/lotto/script/lottoscript.txt` - real repository state-machine/commit-reveal example.

Always compare this guide with the exact node source used for deployment. Consensus limits and function behavior can change across versions.

# Detailed template-by-template builder notes

Each pattern below is deliberately small. "Assumption" describes what the code actually guarantees only when its surrounding transaction and state schema match. A production variant should combine authorization, state transition and exact asset-flow constraints.

## Single-signature ownership

**File:** `01_single_signature.kiss`

**Assumption.** A single transaction signing key may spend the coin.

```kissvm
RETURN SIGNEDBY(0xAA)
```

**Adaptation.** Replace the demonstration key, then test present, absent and unrelated keys. Add output constraints when the coin must continue under a policy.

**Primary failure mode.** A bare signer check allows the signer to choose every output and state value.

**Positive unit test**

```text
runscript script:"RETURN SIGNEDBY(0xAA)" signatures:["0xAA"]
```

**Negative unit test**

```text
runscript script:"RETURN SIGNEDBY(0xAA)" signatures:["0xBB"]
```

## Two-of-three threshold

**File:** `02_multisig_2_of_3.kiss`

**Assumption.** Any two distinct policy keys may authorize.

```kissvm
RETURN MULTISIG(2 0xAA 0xBB 0xCC)
```

**Adaptation.** Replace keys; test all three valid pairs, every single key, no key, and duplicated policy keys.

**Primary failure mode.** A zero threshold is public; duplicated keys can make the apparent participant count misleading.

**Positive unit test**

```text
runscript script:"RETURN MULTISIG(2 0xAA 0xBB 0xCC)" signatures:["0xAA","0xCC"]
```

**Negative unit test**

```text
runscript script:"RETURN MULTISIG(2 0xAA 0xBB 0xCC)" signatures:["0xAA"]
```

## Absolute height timelock

**File:** `03_absolute_block_timelock.kiss`

**Assumption.** Funds release at or after a specific block and require a signer.

```kissvm
ASSERT @BLOCK GTE 1000000
RETURN SIGNEDBY(0xAA)
```

**Adaptation.** Set the intended height; test height-1, height and height+1. Document that reading block marks the contract non-monotonic.

**Primary failure mode.** Using GT instead of GTE changes the release by one block; a signer-only recovery branch can nullify the delay.

**Positive unit test**

```text
runscript script:"ASSERT @BLOCK GTE 1000000 RETURN SIGNEDBY(0xAA)" globals:{"@BLOCK":"1000000"} signatures:["0xAA"]
```

**Negative unit test**

```text
runscript script:"ASSERT @BLOCK GTE 1000000 RETURN SIGNEDBY(0xAA)" globals:{"@BLOCK":"999999"} signatures:["0xAA"]
```

## Relative age timelock

**File:** `04_relative_coinage_timelock.kiss`

**Assumption.** Release depends on how many blocks old the input coin is.

```kissvm
ASSERT @COINAGE GTE 144
RETURN SIGNEDBY(0xAA)
```

**Adaptation.** Choose the age in blocks and test the exact boundary. Recreating the coin resets creation height and therefore coin age.

**Primary failure mode.** A transition that unintentionally recreates the coin can restart the delay.

**Positive unit test**

```text
runscript script:"ASSERT @COINAGE GTE 144 RETURN SIGNEDBY(0xAA)" globals:{"@COINAGE":"144"} signatures:["0xAA"]
```

**Negative unit test**

```text
runscript script:"ASSERT @COINAGE GTE 144 RETURN SIGNEDBY(0xAA)" globals:{"@COINAGE":"143"} signatures:["0xAA"]
```

## Hashlock with timed refund

**File:** `05_htlc_dual_path.kiss`

**Assumption.** Receiver claims with a preimage before/without waiting; sender refunds after timeout.

```kissvm
LET preimage = STATE(0)
LET commitment = SHA3(0x01)
IF SHA3(preimage) EQ commitment THEN
    RETURN SIGNEDBY(0xBB)
ELSEIF @COINAGE GTE 144 THEN
    RETURN SIGNEDBY(0xAA)
ENDIF
RETURN FALSE
```

**Adaptation.** Replace the in-script demonstration commitment with an immutable committed hash and real keys. Bind the commitment to protocol context where replay matters.

**Primary failure mode.** Selective aborts, reusable commitments, wrong hash representation and an unconstrained payout are common failures.

**Positive unit test**

```text
runscript script:"LET preimage=STATE(0) LET commitment=SHA3(0x01) IF SHA3(preimage) EQ commitment THEN RETURN SIGNEDBY(0xBB) ELSEIF @COINAGE GTE 144 THEN RETURN SIGNEDBY(0xAA) ENDIF RETURN FALSE" state:{"0":"0x01"} globals:{"@COINAGE":"0"} signatures:["0xBB"]
```

**Negative unit test**

```text
runscript script:"LET preimage=STATE(0) LET commitment=SHA3(0x01) IF SHA3(preimage) EQ commitment THEN RETURN SIGNEDBY(0xBB) ELSEIF @COINAGE GTE 144 THEN RETURN SIGNEDBY(0xAA) ENDIF RETURN FALSE" state:{"0":"0x02"} globals:{"@COINAGE":"10"} signatures:["0xBB"]
```

## Two-of-three escrow

**File:** `06_three_party_escrow.kiss`

**Assumption.** Buyer and seller can cooperate; an arbiter can pair with either side.

```kissvm
RETURN MULTISIG(2 0xAA 0xBB 0xCC)
```

**Adaptation.** Use three distinct keys and define settlement outputs separately from authorization.

**Primary failure mode.** Threshold authorization alone gives any valid pair complete freedom over distribution.

**Testing.** Build positive and negative `runscript` cases for pure state/global logic. For transaction-dependent checks, construct matching integration transactions and mutate one tuple field at a time.

## Nonce-based state machine

**File:** `07_counter_state_machine.kiss`

**Assumption.** One input recreates one identical-value stateful output while incrementing port 0.

```kissvm
ASSERT STATE(0) EQ INC(PREVSTATE(0))
ASSERT SAMESTATE(1 15)
ASSERT @TOTIN EQ 1
ASSERT @TOTOUT EQ 1
RETURN VERIFYOUT(0 @ADDRESS @AMOUNT @TOKENID TRUE)
```

**Adaptation.** Set immutable ports and decide which output index is the successor. Test stale, skipped and decreased nonce values.

**Primary failure mode.** Without exact output/state checks, incrementing a nonce does not preserve the contract.

**Testing.** Build positive and negative `runscript` cases for pure state/global logic. For transaction-dependent checks, construct matching integration transactions and mutate one tuple field at a time.

## Immutable state range

**File:** `08_immutable_state_schema.kiss`

**Assumption.** Ports in the selected range must equal previous values.

```kissvm
ASSERT SAMESTATE(0 31)
RETURN SIGNEDBY(0xAA)
```

**Adaptation.** Change the range to match the schema and add separate rules for mutable ports.

**Primary failure mode.** SAMESTATE is inclusive; an off-by-one can leave a critical port mutable or freeze a required one.

**Positive unit test**

```text
runscript script:"ASSERT SAMESTATE(0 1) RETURN SIGNEDBY(0xAA)" state:{"0":"1","1":"0xFF"} prevstate:{"0":"1","1":"0xFF"} signatures:["0xAA"]
```

**Negative unit test**

```text
runscript script:"ASSERT SAMESTATE(0 1) RETURN SIGNEDBY(0xAA)" state:{"0":"2","1":"0xFF"} prevstate:{"0":"1","1":"0xFF"} signatures:["0xAA"]
```

## Token identity gate

**File:** `09_token_gate.kiss`

**Assumption.** Only an input carrying a specific token ID reaches signer authorization.

```kissvm
ASSERT @TOKENID EQ 0x01
RETURN SIGNEDBY(0xAA)
```

**Adaptation.** Replace token ID and specify whether amount, outputs or token scale must also be constrained.

**Primary failure mode.** Token identity alone does not prove ownership of a minimum quantity or control outputs.

**Testing.** Build positive and negative `runscript` cases for pure state/global logic. For transaction-dependent checks, construct matching integration transactions and mutate one tuple field at a time.

## Exact payout covenant

**File:** `10_exact_indexed_payout.kiss`

**Assumption.** The transaction has one output with exact index, destination, amount, token and keep-state flag.

```kissvm
ASSERT @TOTOUT EQ 1
RETURN VERIFYOUT(0 0x11 10 0x00 FALSE)
```

**Adaptation.** Replace all tuple fields and use the actual token ID. Test wrong index and extra output.

**Primary failure mode.** Hard-coded demonstration `0x00`/short addresses are placeholders; scaled token units must match.

**Testing.** Build positive and negative `runscript` cases for pure state/global logic. For transaction-dependent checks, construct matching integration transactions and mutate one tuple field at a time.

## Fixed two-way split

**File:** `11_two_output_split.kiss`

**Assumption.** Exactly two outputs pay predetermined recipients and amounts.

```kissvm
ASSERT @TOTOUT EQ 2
ASSERT VERIFYOUT(0 0x11 7 0x00 FALSE)
RETURN VERIFYOUT(1 0x22 3 0x00 FALSE)
```

**Adaptation.** Replace destinations and calculate amounts from trusted policy if variable. Test reversed outputs and rounding.

**Primary failure mode.** Correct totals are insufficient when indexes/destinations are not both constrained.

**Testing.** Build positive and negative `runscript` cases for pure state/global logic. For transaction-dependent checks, construct matching integration transactions and mutate one tuple field at a time.

## Self-recreating covenant

**File:** `12_self_recreating_covenant.kiss`

**Assumption.** One input becomes one stateful output at the same address, amount and token.

```kissvm
ASSERT @TOTIN EQ 1
ASSERT @TOTOUT EQ 1
RETURN VERIFYOUT(0 @ADDRESS @AMOUNT @TOKENID TRUE)
```

**Adaptation.** Add state-transition assertions; confirm output 0 is the intended successor.

**Primary failure mode.** This template freezes value; it does not support fees/withdrawal without redesign.

**Testing.** Build positive and negative `runscript` cases for pure state/global logic. For transaction-dependent checks, construct matching integration transactions and mutate one tuple field at a time.

## Bounded withdrawal vault

**File:** `13_bounded_withdrawal_vault.kiss`

**Assumption.** A requested amount is positive, below a previous-state limit, and split into successor plus payout.

```kissvm
LET withdrawal = STATE(0)
LET limit = PREVSTATE(1)
ASSERT withdrawal GT 0
ASSERT withdrawal LTE limit
ASSERT STATE(1) EQ limit
ASSERT @INPUT EQ 0
ASSERT @TOTOUT EQ 2
ASSERT VERIFYOUT(0 @ADDRESS @AMOUNT-withdrawal @TOKENID TRUE)
RETURN VERIFYOUT(1 PREVSTATE(2) withdrawal @TOKENID FALSE)
```

**Adaptation.** Define port 2 payout address, add signer/nonce rules, and validate successor state.

**Primary failure mode.** The example assumes input 0 and two outputs; arithmetic and token scaling require boundary tests.

**Testing.** Build positive and negative `runscript` cases for pure state/global logic. For transaction-dependent checks, construct matching integration transactions and mutate one tuple field at a time.

## Authorized nonce transition

**File:** `14_nonce_authorized_transition.kiss`

**Assumption.** A stored key signs and nonce increments exactly once while configuration stays fixed.

```kissvm
LET nonce = STATE(0)
ASSERT nonce EQ INC(PREVSTATE(0))
ASSERT SIGNEDBY(PREVSTATE(1))
ASSERT SAMESTATE(1 10)
RETURN TRUE
```

**Adaptation.** Choose immutable range and bind exact successor output.

**Primary failure mode.** Returning true without a covenant lets the signer spend away rather than continue the state machine.

**Testing.** Build positive and negative `runscript` cases for pure state/global logic. For transaction-dependent checks, construct matching integration transactions and mutate one tuple field at a time.

## Bitfield permission check

**File:** `15_bitfield_permissions.kiss`

**Assumption.** A fixed bit in previous-state bytes grants a capability to a stored key.

```kissvm
LET permissions = PREVSTATE(0)
ASSERT BITGET(permissions 0)
ASSERT SIGNEDBY(PREVSTATE(1))
RETURN TRUE
```

**Adaptation.** Set exact bitfield width and normalize with SETLEN after mutation. Build bit-order test vectors.

**Primary failure mode.** Java BitSet indexing and compact output can violate visual big-endian assumptions.

**Testing.** Build positive and negative `runscript` cases for pure state/global logic. For transaction-dependent checks, construct matching integration transactions and mutate one tuple field at a time.

## Local reusable function

**File:** `16_dynamic_function_safe_demo.kiss`

**Assumption.** An immutable local body compares amount to a threshold and returns through `returnvalue`.

```kissvm
LET body = [LET returnvalue = $1 GTE $2]
LET allowed = FUNCTION(body @AMOUNT 10)
RETURN allowed AND SIGNEDBY(0xAA)
```

**Adaptation.** Keep the body constant and pass typed parameters. Test the final substituted text.

**Primary failure mode.** Text substitution is code generation; untrusted script arguments can change grammar.

**Positive unit test**

```text
runscript script:"LET body=[LET returnvalue = $1 GTE $2] LET allowed=FUNCTION(body @AMOUNT 10) RETURN allowed AND SIGNEDBY(0xAA)" globals:{"@AMOUNT":"10"} signatures:["0xAA"]
```

**Negative unit test**

```text
runscript script:"LET body=[LET returnvalue = $1 GTE $2] LET allowed=FUNCTION(body @AMOUNT 10) RETURN allowed AND SIGNEDBY(0xAA)" globals:{"@AMOUNT":"9"} signatures:["0xAA"]
```

## Authenticated dynamic execution

**File:** `17_exec_hash_authorized.kiss`

**Assumption.** Current-state script must match a hash committed in previous state.

```kissvm
LET candidate = STATE(0)
ASSERT SHA3(candidate) EQ PREVSTATE(0)
EXEC candidate
RETURN FALSE
```

**Adaptation.** Store a domain-separated hash, constrain script length, and test that the executed branch explicitly returns.

**Primary failure mode.** Hash authorization validates bytes, not business safety; an approved script may still be dangerous.

**Testing.** Build positive and negative `runscript` cases for pure state/global logic. For transaction-dependent checks, construct matching integration transactions and mutate one tuple field at a time.

## MAST leaf dispatch

**File:** `18_mast_leaf_dispatch.kiss`

**Assumption.** Witness contains a script and proof matching the committed hash.

```kissvm
MAST 0xAA
RETURN FALSE
```

**Adaptation.** Replace the placeholder hash and provide `extrascripts` proof material. Maintain a leaf manifest.

**Primary failure mode.** Untested hidden branches and malformed proof chains are common integration failures.

**Testing.** Build positive and negative `runscript` cases for pure state/global logic. For transaction-dependent checks, construct matching integration transactions and mutate one tuple field at a time.

## Oracle attestation

**File:** `19_explicit_checksig_oracle.kiss`

**Assumption.** An oracle signs exact message bytes and a transaction key also authorizes.

```kissvm
LET oraclekey = PREVSTATE(0)
LET message = STATE(0)
LET signature = STATE(1)
ASSERT CHECKSIG(oraclekey message signature)
RETURN SIGNEDBY(PREVSTATE(1))
```

**Adaptation.** Define fixed-width, domain-separated message serialization and expiry/nonce policy.

**Primary failure mode.** Signing ambiguous or replayable bytes can authorize a different action or repeated spend.

**Testing.** Build positive and negative `runscript` cases for pure state/global logic. For transaction-dependent checks, construct matching integration transactions and mutate one tuple field at a time.

## MMR membership and sum proof

**File:** `20_mmr_membership.kiss`

**Assumption.** Current state supplies leaf/proof and previous state commits to root hash and root sum.

```kissvm
LET leaf = STATE(0)
LET leafsum = STATE(1)
LET roothash = PREVSTATE(0)
LET rootsum = PREVSTATE(1)
LET proofchain = STATE(2)
RETURN PROOF(leaf leafsum roothash rootsum proofchain)
```

**Adaptation.** Define leaf encoding, sum meaning and proof source. Test malformed serialization and wrong sum.

**Primary failure mode.** A valid membership proof does not automatically establish freshness or application authorization.

**Testing.** Build positive and negative `runscript` cases for pure state/global logic. For transaction-dependent checks, construct matching integration transactions and mutate one tuple field at a time.

## Bounded in-memory allowlist

**File:** `21_array_allowlist.kiss`

**Assumption.** Tuple array contains two keys and a bounded loop searches them.

```kissvm
LET (0) = 0xAA
LET (1) = 0xBB
LET candidate = STATE(0)
LET counter = 0
LET found = FALSE
WHILE counter LT 2 DO
    IF GET(counter) EQ candidate THEN LET found = TRUE ENDIF
    LET counter = INC(counter)
ENDWHILE
RETURN found AND SIGNEDBY(candidate)
```

**Adaptation.** For large lists use MAST/MMR proof instead. Keep a hard counter bound.

**Primary failure mode.** Inline scanning consumes instructions and duplicate/empty entries can weaken policy assumptions.

**Testing.** Build positive and negative `runscript` cases for pure state/global logic. For transaction-dependent checks, construct matching integration transactions and mutate one tuple field at a time.

## Selective state evolution

**File:** `22_preserve_selected_state.kiss`

**Assumption.** Ports 0-9 remain fixed and port 10 increments while a successor output is recreated.

```kissvm
ASSERT SAMESTATE(0 9)
ASSERT STATE(10) EQ INC(PREVSTATE(10))
RETURN VERIFYOUT(@INPUT @ADDRESS @AMOUNT @TOKENID TRUE)
```

**Adaptation.** Map exact mutable/immutable ports and constrain transaction shape.

**Primary failure mode.** Unvalidated ports above 10 remain freely changeable.

**Testing.** Build positive and negative `runscript` cases for pure state/global logic. For transaction-dependent checks, construct matching integration transactions and mutate one tuple field at a time.

## Emergency escape

**File:** `23_emergency_escape_plus_covenant.kiss`

**Assumption.** A recovery key can exit immediately; otherwise the normal covenant applies.

```kissvm
LET rescuekey = PREVSTATE(100)
IF SIGNEDBY(rescuekey) THEN RETURN TRUE ENDIF
ASSERT SAMESTATE(0 99)
RETURN VERIFYOUT(@INPUT @ADDRESS @AMOUNT @TOKENID TRUE)
```

**Adaptation.** Decide whether recovery should also be delayed, threshold-controlled or destination-constrained.

**Primary failure mode.** An emergency key is a full bypass in this example and becomes the dominant security risk.

**Testing.** Build positive and negative `runscript` cases for pure state/global logic. For transaction-dependent checks, construct matching integration transactions and mutate one tuple field at a time.

## Commit-reveal state rounds

**File:** `24_commit_reveal_round.kiss`

**Assumption.** Round increments; round 1 preserves setup and round 2 verifies a reveal.

```kissvm
LET round = STATE(0)
ASSERT round EQ INC(PREVSTATE(0))
IF round EQ 1 THEN
    ASSERT SAMESTATE(1 7)
    RETURN VERIFYOUT(@INPUT @ADDRESS @AMOUNT @TOKENID TRUE)
ELSEIF round EQ 2 THEN
    LET preimage = STATE(9)
    ASSERT SHA3(preimage) EQ PREVSTATE(2)
    RETURN SIGNEDBY(PREVSTATE(1))
ENDIF
RETURN FALSE
```

**Adaptation.** Add exact output economics, timeout branches, randomness rules and signer policy.

**Primary failure mode.** Commit-reveal fairness can fail through aborts, predictable entropy or missing payout covenants.

**Testing.** Build positive and negative `runscript` cases for pure state/global logic. For transaction-dependent checks, construct matching integration transactions and mutate one tuple field at a time.

# Appendix A. Complete built-in function catalog

The registry below follows `MinimaFunction.ALL_FUNCTIONS` in the pinned snapshot. Parameter names are explanatory. "ANY" means one of the four KISSVM value types.

| Category | Function | Signature | Returns | Notes |

|---|---|---|---|---|

| Cast | `ASCII` | `ASCII(hex)` | `SCRIPT` | Decode bytes with US-ASCII. |

| Cast | `BOOL` | `BOOL(value)` | `BOOLEAN` | Zero numbers/hex are false; script is false only when exactly FALSE. |

| Cast | `HEX` | `HEX(value)` | `HEX` | Numbers must be non-negative whole values; scripts become their bytes. |

| Cast | `NUMBER` | `NUMBER(value)` | `NUMBER` | Hex is interpreted as a positive data value; script must parse as a number. |

| Cast | `STRING` | `STRING(value)` | `SCRIPT` | Uses the value textual representation. |

| Cast | `UTF8` | `UTF8(hex)` | `SCRIPT` | Decode bytes as UTF-8. |

| General | `ADDRESS` | `ADDRESS(script)` | `HEX` | Calculate the address data of an exact script value. |

| General | `EXISTS` | `EXISTS(index...)` | `BOOLEAN` | Test whether a numeric tuple-keyed array entry exists. |

| General | `FUNCTION` | `FUNCTION(script [arg...])` | `ANY` | Replace $1... placeholders, execute, return variable returnvalue or TRUE. |

| General | `GET` | `GET(index...)` | `ANY` | Retrieve a numeric tuple-keyed array entry; missing entry throws. |

| Data | `BITCOUNT` | `BITCOUNT(hex)` | `NUMBER` | Count set bits. |

| Data | `BITGET` | `BITGET(hex bit)` | `BOOLEAN` | Read indexed bit; index is bounded by byte length. |

| Data | `BITSET` | `BITSET(hex bit boolean)` | `HEX` | Set/clear indexed bit; returned byte array may be compacted. |

| Data | `CONCAT` | `CONCAT(hex hex...)` | `HEX` | Concatenate two or more hex values, bounded by max data size. |

| Data | `LEN` | `LEN(hex_or_script)` | `NUMBER` | Byte length for hex; Java character count for script/string. |

| Data | `OVERWRITE` | `OVERWRITE(src srcpos dest destpos len)` | `HEX` | Copy a byte range from src into a cloned destination. |

| Data | `REV` | `REV(hex)` | `HEX` | Reverse byte order. |

| Data | `SETLEN` | `SETLEN(length hex)` | `HEX` | Resize/pad a hex value to an exact byte length. |

| Data | `SUBSET` | `SUBSET(start end hex)` | `HEX` | Half-open byte slice [start,end). |

| Number | `ABS` | `ABS(number)` | `NUMBER` | Absolute value. |

| Number | `CEIL` | `CEIL(number)` | `NUMBER` | Ceiling. |

| Number | `DEC` | `DEC(number)` | `NUMBER` | Subtract one. |

| Number | `FLOOR` | `FLOOR(number)` | `NUMBER` | Floor. |

| Number | `INC` | `INC(number)` | `NUMBER` | Add one. |

| Number | `MAX` | `MAX(number number...)` | `NUMBER` | Maximum of at least two numbers. |

| Number | `MIN` | `MIN(number number...)` | `NUMBER` | Minimum of at least two numbers. |

| Number | `POW` | `POW(number exponent)` | `NUMBER` | Exponentiation; validate domains and instruction cost in tests. |

| Number | `SIGDIG` | `SIGDIG(number digits)` | `NUMBER` | Round/limit to significant digits. |

| Number | `SQRT` | `SQRT(number)` | `NUMBER` | Square root; negative input fails. |

| Hash / proof | `PROOF` | `PROOF(data leafsum roothash rootsum proofchain)` | `BOOLEAN` | Verify an MMR proof against hash and sum. |

| Hash / proof | `SHA2` | `SHA2(hex_or_script)` | `HEX` | SHA-2 hash of raw bytes. |

| Hash / proof | `SHA3` | `SHA3(hex_or_script)` | `HEX` | Minima Crypto hashData operation over raw bytes. |

| Signature | `CHECKSIG` | `CHECKSIG(pubkey data signature)` | `BOOLEAN` | Explicit cryptographic verification; costs 32 instruction units. |

| Signature | `MULTISIG` | `MULTISIG(required pubkey...)` | `BOOLEAN` | At least required keys must occur in the transaction signature-key set. |

| Signature | `SIGNEDBY` | `SIGNEDBY(pubkey)` | `BOOLEAN` | Test whether a public key occurs in the transaction signature-key set. |

| State | `PREVSTATE` | `PREVSTATE(port)` | `ANY` | Read the spent coin previous state; missing port throws. |

| State | `SAMESTATE` | `SAMESTATE(start end)` | `BOOLEAN` | Compare an inclusive state-port range; prior ports must exist. |

| State | `STATE` | `STATE(port)` | `ANY` | Read current/proposed transaction state; missing port throws. |

| String | `REPLACE` | `REPLACE(script search replacement)` | `SCRIPT` | Replace all literal occurrences, with size limits. |

| String | `REPLACEFIRST` | `REPLACEFIRST(script search replacement)` | `SCRIPT` | Replace the first literal occurrence. |

| String | `SUBSTR` | `SUBSTR(start end script)` | `SCRIPT` | Half-open character substring. |

| Transaction input | `GETINADDR` | `GETINADDR(index)` | `HEX` | Address of indexed input. |

| Transaction input | `GETINAMT` | `GETINAMT(index)` | `NUMBER` | Scaled amount of indexed input. |

| Transaction input | `GETINID` | `GETINID(index)` | `HEX` | Coin ID of indexed input. |

| Transaction input | `GETINTOK` | `GETINTOK(index)` | `HEX` | Token ID of indexed input. |

| Transaction input | `SUMINPUTS` | `SUMINPUTS(tokenid)` | `NUMBER` | Sum scaled amounts of inputs for a token. |

| Transaction input | `VERIFYIN` | `VERIFYIN(index address amount tokenid)` | `BOOLEAN` | Exact indexed input tuple check. |

| Transaction output | `GETOUTADDR` | `GETOUTADDR(index)` | `HEX` | Address of indexed output. |

| Transaction output | `GETOUTAMT` | `GETOUTAMT(index)` | `NUMBER` | Scaled amount of indexed output. |

| Transaction output | `GETOUTKEEPSTATE` | `GETOUTKEEPSTATE(index)` | `BOOLEAN` | Whether indexed output stores state. |

| Transaction output | `GETOUTTOK` | `GETOUTTOK(index)` | `HEX` | Token ID of indexed output. |

| Transaction output | `SUMOUTPUTS` | `SUMOUTPUTS(tokenid)` | `NUMBER` | Sum scaled amounts of outputs for a token. |

| Transaction output | `VERIFYOUT` | `VERIFYOUT(index address amount tokenid [keepstate])` | `BOOLEAN` | Exact indexed output check; optional keep-state comparison. |

## Function review rules

1. Verify exact arity during parse tests. 2. Exercise wrong-type inputs. 3. Exercise all index/range boundaries. 4. Confirm byte and decimal representations. 5. Inspect trace and instruction usage. 6. Treat malformed external proof/signature/script data as an expected adversarial input.

# Appendix B. Template inventory and test cookbook

| File | Purpose |

|---|---|

| `01_single_signature.kiss` | Basic owner authorization. |

| `02_multisig_2_of_3.kiss` | Threshold authorization. |

| `03_absolute_block_timelock.kiss` | Block-height release. |

| `04_relative_coinage_timelock.kiss` | Age-relative release. |

| `05_htlc_dual_path.kiss` | Preimage claim or timed refund. |

| `06_three_party_escrow.kiss` | Two-party agreement or arbiter resolution. |

| `07_counter_state_machine.kiss` | Strict nonce increment and self recreation. |

| `08_immutable_state_schema.kiss` | Preserve a state range. |

| `09_token_gate.kiss` | Restrict by token identity. |

| `10_exact_indexed_payout.kiss` | Exact single payout covenant. |

| `11_two_output_split.kiss` | Exact two-recipient split. |

| `12_self_recreating_covenant.kiss` | Preserve address, value, token and state. |

| `13_bounded_withdrawal_vault.kiss` | Per-transition withdrawal cap. |

| `14_nonce_authorized_transition.kiss` | Authorized, replay-resistant transition. |

| `15_bitfield_permissions.kiss` | Compact permission flags. |

| `16_dynamic_function_safe_demo.kiss` | Typed local reusable logic. |

| `17_exec_hash_authorized.kiss` | Hash-authorized dynamic execution. |

| `18_mast_leaf_dispatch.kiss` | Witness-proven script branch. |

| `19_explicit_checksig_oracle.kiss` | Arbitrary-message signature verification. |

| `20_mmr_membership.kiss` | MMR membership/sum proof. |

| `21_array_allowlist.kiss` | Tuple array and bounded scan. |

| `22_preserve_selected_state.kiss` | Immutable range plus mutable nonce. |

| `23_emergency_escape_plus_covenant.kiss` | Recovery key and normal covenant. |

| `24_commit_reveal_round.kiss` | Two-round state transition. |

The JSON cookbook contains ready-to-adapt positive and negative commands for representative templates. Transaction-dependent templates require constructing matching input/output coins and are documented as integration tests rather than pure `runscript` unit tests.

# Appendix C. Glossary

**Address.** Hash-derived locking identifier calculated from an exact script.

**Coin / UTXO.** An unspent output carrying amount, token, address and optional state.

**Covenant.** A script condition that constrains the transaction outputs or successor coin.

**Current state.** State values proposed by the spending transaction and read with STATE.

**Previous state.** State attached to the spent input coin and read with PREVSTATE.

**Keep state.** Output flag indicating state should be stored on the successor coin.

**MAST.** Merkelized Alternative Script Tree; reveal and execute one committed script leaf.

**Monotonic.** VM metadata indicating whether time/block-dependent globals were avoided.

**RAM script.** The KISSVM source text evaluated for an input.

**Scaled token amount.** Human-facing token amount after token scale is applied.

**Witness.** Transaction data carrying signatures, scripts and proofs required for validation.
