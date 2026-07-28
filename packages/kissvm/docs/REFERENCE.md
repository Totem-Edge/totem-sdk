# KISSVM Reference

## Evaluator API

### `evaluateScript(script, witness, txCtx)`

```ts
function evaluateScript(
  script: string,
  witness: ScriptWitness,
  txCtx: TxContext,
): EvalResult
```

Evaluates a KISSVM script against a transaction context and witness material.

- **`script`** — KISSVM source code (no `//` comments lexed; only single-line `//` supported)
- **`witness`** — signatures, preimages, MAST ScriptProofs
- **`txCtx`** — block height, inputs, outputs, state, prevState
- **Returns** `EvalResult` — `{ passed: boolean, trace: string[], error?: string, instructionsUsed: number }`
- **Throws** `KissvmLimitError` if instruction limit, stack depth limit, or shift-size limit exceeded

```ts
interface EvalResult {
  passed: boolean
  trace: string[]
  error?: string
  instructionsUsed: number
}
```

### `simulateSpend(script, witness, coinData, outputs, block)`

```ts
function simulateSpend(
  script: string,
  witness: ScriptWitness,
  coinData: CoinData,
  outputs: OutputData[],
  block: number,
): EvalResult
```

Convenience wrapper — builds a `TxContext` with a single input and runs `evaluateScript`.

### `buildWitness(inputs)`

```ts
function buildWitness(inputs: WitnessInput[]): ScriptWitness
```

Constructs a `ScriptWitness` from simplified input descriptors. Each `WitnessInput` can specify:
- `publicKey` / `signature` — for SIGNEDBY/CHECKSIG
- `preimage` / `hash` — for HTLC preimage revelation
- `script` / `proof` — for MAST ScriptProof verification

### `parseScript(source)`

```ts
function parseScript(source: string): ASTNode[]
```

Tokenizes and parses KISSVM source into an AST. Exposed for tooling and inspection.

## Public types

### `TxContext`

```ts
interface TxContext {
  block: number
  blockMilli?: number
  inputIndex: number
  inputs: CoinData[]
  outputs: OutputData[]
  state: Record<number, string>
  prevState: Record<number, string>
  txDigest?: Uint8Array
  mastBranches?: Map<string, string>
  prevCoins?: CoinData[]
  simulationMode?: boolean
}
```

| Field | Description |
|-------|-------------|
| `block` | Current block height. Read by `@BLOCK`. |
| `blockMilli` | Block timestamp in ms. Read by `@BLOCKMILLI`. |
| `inputIndex` | Index of the input coin currently being evaluated. Read by `@INPUT`. |
| `inputs` | All input coins. `@TOTIN` returns `inputs.length` (count, not sum). |
| `outputs` | All output coins. `@TOTOUT` returns `outputs.length`. |
| `state` | Current state (port → MiniData hex string). Read by `STATE(n)`. |
| `prevState` | Previous state from the spent coin. Read by `PREVSTATE(n)`. |
| `txDigest` | 32-byte transaction digest for real WOTS signature verification. |
| `mastBranches` | MAST branch map (hash → script text). For legacy MAST resolution. |
| `prevCoins` | Previous versions of the input coins. Used by `SAMECOINS`. |
| `simulationMode` | When `true`, `SIGNEDBY`/`CHECKSIG` only check signature *presence* without verifying against a txDigest. Use for unit testing only. |

### `CoinData`

```ts
interface CoinData {
  amount: number
  tokenId: string
  coinId: string
  address: string
  coinCreatedBlock?: number
  scriptHash?: string
}
```

| Field | Used by | Description |
|-------|---------|-------------|
| `amount` | `@AMOUNT` | Coin value |
| `tokenId` | `@TOKENID` | Token identity hex |
| `coinId` | `@COINID` | Unique coin identifier |
| `address` | `@ADDRESS` | Locking address |
| `coinCreatedBlock` | `@COINAGE`, `@CREATED` | Block when coin was created. `@COINAGE = block - coinCreatedBlock`. |
| `scriptHash` | `@SCRIPT` | SHA3-256 of the locking script |

### `OutputData`

```ts
interface OutputData {
  address: string
  amount: number
  tokenId: string
  keepState: boolean
}
```

Used by `VERIFYOUT(index, address, amount, tokenId, keepState)`.

### `ScriptWitness`

```ts
interface ScriptWitness {
  signatures: Map<string, Uint8Array>
  preimages?: Map<string, string>
  scriptProofs?: ScriptProof[]
}
```

- `signatures` — pubkey-hex (lowercase, no `0x`) → 1088-byte WOTS signature
- `preimages` — hash-hex → preimage (for HTLC)
- `scriptProofs` — canonical MMR proofs for MAST branch revelation

### `ScriptProof`

```ts
interface ScriptProof {
  script: string
  proofHex: string
  address: string
}
```

Canonical Minima ScriptProof: script text + MMR proof hex + computed address.

## Globals (`@`-prefixed)

| Global | Source | Description |
|--------|--------|-------------|
| `@BLOCK` | `txCtx.block` | Current block height |
| `@BLOCKMILLI` | `txCtx.blockMilli` | Block timestamp in ms |
| `@COINAGE` | computed | `block - coinCreatedBlock` |
| `@CREATED` | `coin.coinCreatedBlock` | Block when input coin was created |
| `@AMOUNT` | `coin.amount` | Value of the input coin being spent |
| `@TOKENID` | `coin.tokenId` | Token identity of the input coin |
| `@ADDRESS` | `coin.address` | Address of the input coin |
| `@COINID` | `coin.coinId` | Unique identifier of the input coin |
| `@SCRIPT` | `coin.scriptHash` | SHA3-256 of the locking script |
| `@INPUT` | `txCtx.inputIndex` | Index of the input being evaluated |
| `@TOTIN` | `inputs.length` | Total number of transaction inputs (count, not sum) |
| `@TOTOUT` | `outputs.length` | Total number of transaction outputs (count) |

## Built-in functions

### Arithmetic

| Function | Description |
|----------|-------------|
| `INC(x)` | `x + 1` |
| `DEC(x)` | `x - 1` |
| `ABS(x)` | Absolute value |
| `MIN(a, b)` | Minimum |
| `MAX(a, b)` | Maximum |
| `INT(x)` | Convert to number |
| `SIGDIG(n, x)` | Set significant digits |

### String / data

| Function | Description |
|----------|-------------|
| `STR(x)` | Convert to string |
| `LEN(x)` | Byte length of hex/string |
| `SIZE(x)` | Byte length |
| `CONCAT(a, b, ...)` | String concatenation |
| `SUBSTR(s, start, len?)` | Substring |
| `REVERSE(x)` | Reverse hex bytes or string characters |
| `HEXTOSTR(x)` | Decode hex to ASCII |
| `STRTOHEX(x)` | Encode ASCII to hex |
| `NUMTOSTR(x)` | Number to string |

### Hashing

| Function | Description |
|----------|-------------|
| `SHA3(x)` | SHA3-256 hash |
| `SHA2(x)` | SHA-256 hash |
| `HASH(x)` | Legacy hash (SHA3-256 in current implementations) |

### Authorization

| Function | Description |
|----------|-------------|
| `SIGNEDBY(pubKey)` | Check pubKey has a valid signature in the witness |
| `MULTISIG(threshold, k1, k2, ...)` | Check threshold t-of-n signatures |
| `CHECKSIG(pubKey?, msg?, sig?)` | Arbitrary-message signature verification |

### State

| Function | Description |
|----------|-------------|
| `STATE(port)` | Read current state port |
| `PREVSTATE(port)` | Read previous state port |
| `SAMESTATE(from, to)` | Check state range unchanged |
| `STORE STATE(port) WITH value` | Write to state (statement) |

### Transaction introspection

| Function | Description |
|----------|-------------|
| `VERIFYOUT(idx, addr, amt, tok, keepState)` | Assert output at index matches |
| `GETOUTAMT(idx)`, `GETOUTADDR(idx)`, `GETOUTTOK(idx)`, `GETOUTKEEPSTATE(idx)` | Read output fields |
| `SAMECOINS` | Check inputs are same coins as prevCoins (spend-from-self) |
| `COINDATA` | Serialized coin data string |

### MAST & MMR

| Function | Description |
|----------|-------------|
| `MAST rootHash` | Verify ScriptProof from witness matching rootHash, then execute |
| `EXEC MAST` | Execute braced MAST block (`MAST { … }`) |
| `EXEC script` | Dynamically execute a script string |
| `PROOF(data, leafSum, rootHash, rootSum, proofHex)` | Verify MMR membership proof |

### Bitwise & arrays

| Function | Description |
|----------|-------------|
| `BITGET(x, n)` | Get bit `n` of `x` (0-indexed) |
| `BITSET(x, n, v)` | Set bit `n` of `x` to `0`/`1` |
| `GET(n)` | Read tuple array element `n` (from `LET (n) = value`) |
| `LET (n) = value` | Write to tuple array (statement) |

See the full 53-function Minima catalog in the:
[KISSVM Comprehensive Guide §Appendix A](./KISSVM_Comprehensive_Guide.md)

## Environment limits

| Limit | Default | Enforced by |
|-------|---------|-------------|
| Instruction count | 10,000 | `KissvmLimitError` |
| Call depth | 256 | `KissvmLimitError` |
| Shift width | 256 bits | `KissvmLimitError` |
| Hex/string size | 64 KB | `KissvmLimitError` |
| Function params | 32 | `KissvmLimitError` |

## Minima semantics absorbed

The evaluator matches Minima commit `74316b11b6ce724f36ff757ad30113f2dcc04990` with these verified behaviours:

- **`@TOTIN` / `@TOTOUT`** — count of inputs/outputs, **not** sum of amounts
- **`STATE(n)`** — hex strings are returned as `0x...`; numeric strings as MiniNumber; empty as `0`
- **`asMiniNumber`** — hex strings (`0x05` → 5) are parsed as unsigned BigInt (up to ~64 hex digits)
- **`INC` / `DEC`** — MiniNumber arithmetic (+1 / −1)
- **`BITGET` / `BITSET`** — BigInt bit operations, 0-indexed
- **`FUNCTION`** — dynamic evaluation: substitutes `$1`, `$2`… with actual args, parses body, executes, returns LET RHS value or RETURN value
- **`GET(n)`** — retrieves tuple stored via `LET (n) = value`
- **`EXEC`** — decodes hex-encoded scripts (`0x...`) to UTF-8 before parsing
- **`PROOF`** — data arg in PROOF can be a script expression (STRING encoding) or a literal (HEX encoding); empty proof means single-leaf tree
- **`@COINAGE`** — computed from `block - coinCreatedBlock` (set `CoinData.coinCreatedBlock` for timelock tests)
- **`SAMESTATE`** — compares string-normalized (hex lowercase, 0x-prefixed) state values
- **`SIGNEDBY`** / `CHECKSIG` in simulation mode — only checks signature map presence, skips WOTS verification

## Minima guide

The canonical KISSVM Comprehensive Guide (1437 lines, 20 chapters, 3 appendices) is available as:

- Markdown: [`./KISSVM_Comprehensive_Guide.md`](./KISSVM_Comprehensive_Guide.md)
- 24 example scripts: [`./examples/`](./examples/)
- Test cookbook: [`./examples/test-cookbook.json`](./examples/test-cookbook.json)
