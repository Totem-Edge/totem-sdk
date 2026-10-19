# SDK TODO

Open SDK work items, tracked here rather than worked around downstream. **Rule:**
if an issue is an SDK issue, fix it in the SDK — no hidden workarounds, no
tolerant fallbacks that mask a defect.

---

## minima-rpc — cover the full Hawk node command set  *(OPEN)*

`@totemsdk/minima-rpc`'s `buildCommandString` switch covers ~40 commands, but the
hawk node exposes **132** (source of truth: the in-node MCP `tools/list`, i.e. the
RFC-0011 capability manifest). Commands reachable only through the generic
`default` case lose typed parameter handling (names, ordering, coercion) and can
trip the 1024-char `sanitizeRpcValue` cap on large payloads.

**Task:** generate the switch from the MCP manifest (`POST /mcp`, `tools/list`,
`inputSchema`) so every command is covered with its real parameter names/types —
including the MASH and agentic surfaces (`mashnewaddress`, `mashtxnsign`,
`mashretx*`, `mashrootstatus`, `mashaddresses`, `mashaddressinfo`, `mashretire`,
`mashtxnverify`, `capabilities`, `mcp`-adjacent, `duckdb*`, `megammr*`, the full
`txn*` family, etc.).

**Also:** review the 1024-char `sanitizeRpcValue` cap — `txnminepost data:<hex>`
carries a full TxPoW (several KB); the cap is a correct injection guard for
whitespace, but must not reject a legitimate large hex payload. Fix the size
handling (the whitespace/control-char rejection stays).

---

## minima-rpc transport — node RPC line endings  *(OPEN — fix at source)*

The hawk node's RPC response uses **LF** line endings by default
(`HTTP/1.1 200 OK\n…`), which is non-compliant; Node's `fetch` (undici) rejects
it (`HPE_INVALID_HEADER_TOKEN`) and even `node:http` fails ("Missing expected CR
after response line"). `curl` tolerates it, which hid the problem. The node can
emit CRLF with `-rpccrlf`.

**Task:** do **not** paper over this in the SDK (e.g. a tolerant/raw fallback).
Resolve it at the source so the SDK talks to a compliant server:
- **node-side:** make CRLF the default (HTTP requires it), so any standard client
  works without a flag; keep `-rpccrlf` as a no-op/deprecated.
- The SDK's `postCommand` must remain a strict, correct HTTP client — the
  existing `raw-http` fallback exists for genuinely unparseable servers, not as a
  standing workaround for a fixable defect.

---

## omnia swarm — `_stream.onData is not a function`  *(OPEN)*

Opening a channel now clears signing + witness assembly and reaches the swarm
step (`context.swarm.connectToPeer(...)` → `CHANNEL_PROPOSAL`), which throws
`TypeError: _stream.onData is not a function`. The native swarm appears to rely
on a Bare/Pear stream API (`onData`) that does not exist in Node — so the
`omnia-host` cannot open a channel under Node with `mode: 'native'`.

**Task:** fix the swarm so it runs under Node (feature-detect the stream API, or
provide a Node stream adapter), or make the relay mode the documented Node path.
Do not paper over it in `omnia-host`.

---

## Node RPC compatibility  *(FIXED — node-side)*

Two node-side RPC defects blocked standard HTTP clients (Node undici). Both are
fixed at source in the hawk node (not worked around in the SDK):
- LF → **CRLF** line endings (default), and CRLF the 401/413 bodies.
- **case-insensitive `Content-Length`** header match (undici sends lowercase).

These are recorded here because they were discovered via the SDK's real client;
if similar defects recur, fix them in the node, not with an SDK fallback.

---

## omnia-host / omnia — funding path  *(DONE, verify)*

- `createChannel` funding witness: `fundingSigner` + `fundingProofs` (commit
  `d93e468`).
- `openChannel` funding wiring: `fundingPubkey`, proofs, local participant
  (commit `4c4d508`).
- **Verify end-to-end** once the transport issue above is fixed: open a channel
  between two Omnia nodes and settle a payment.
- **Document** the required config: `OMNIA_LOCAL_PUBKEY` / `OMNIA_LOCAL_PARTY_ID`
  / `OMNIA_LOCAL_ADDRESS_INDEX` (mutations fail without them) and `operationId`
  on every mutation.
