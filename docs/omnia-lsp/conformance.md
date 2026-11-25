# Omnia LSP — conformance and acceptance

**Status:** Draft. This file records the Phase 0 vectors and the Phase 1
acceptance gates, and separates what is covered from what is still open.

**Canonical RFC:** [RFC-081](../rfc/RFC-081-OMNIA-LSP.md) §16.

## 1. Test vectors

| Vector | Expected result |
|---|---|
| `packages/omnia-lsp/test-vectors/manifest.valid.json` | accepted |
| `packages/omnia-lsp/test-vectors/manifest.invalid-capacity.json` | rejected: `minChannel > maxChannel` |
| `packages/omnia-lsp/test-vectors/manifest.invalid-channel-key.json` | rejected: malformed channel key digest |
| `packages/omnia-lsp/test-vectors/manifest.invalid-hosted.json` | rejected: hosted custody without disclosure |
| `packages/omnia-lsp/test-vectors/open-quote.valid.json` | accepted |

Additional vectors pending: stale quote, wrong provider, wrong consumer, wrong
token, wrong channel identity, wrong witness, wrong coin, replay, abort/timeout.

## 2. Unit suites

| Suite | Command | Current result |
|---|---|---|
| Manifest, quote and ranking | `pnpm --filter @totemsdk/omnia-lsp test` | **12 passed** |
| Provider policy, quote and host adapter | `pnpm --filter @totemsdk/omnia-lsp-provider test` | **16 passed** |
| Funding witness, Axia proofs, relay | workspace `omnia` tests | 13 passed |
| Local/Axia lease adapters | workspace `wots-lease` tests | 5 passed, 1 live skipped |

The LSP suites cover:

- valid manifest; malformed channel key; capacity inversion; hosted custody
  without disclosure; stale manifest; hosted custody rejected by policy;
- valid quote; quote for a different provider; quote/manifest channel identity
  mismatch;
- ranking by score, fee and capacity; capacity/policy filtering; bond
  requirement;
- provider admission policy: provider mismatch, insufficient capacity, lease
  not offered, hosted custody rejected;
- terms-bound unsigned quote; signed quote; facade quote + open delegation;
  expired quote rejected before delegation;
- host adapter side swap, operation ids, unsupported method and close
  delegation; provider-selected funding material and host auto-selection when
  no funding coin is supplied.

## 3. Phase 1 acceptance gates

A Phase 1 acceptance run must demonstrate:

1. A new wallet with zero channels discovers a launch provider.
2. It receives and verifies a signed, fresh quote that matches the manifest.
3. The wallet selects its own funding coin and builds/signs the witness.
4. A dApp-supplied witness is rejected.
5. The provider verifies the coin, amount, token, script and witness and
   co-signs.
6. The channel opens, both sides agree it is active, and the wallet can pay.
7. A cooperative close refunds the agreed balances.
8. An abort before broadcast leaves the funding coin unspent and releases
   reserved WOTS indices.
9. A stale quote, wrong coin, wrong witness or replay is rejected.
10. The whole flow works consumer extension ↔ provider host across two hosts.

## 4. Current coverage

| Gate | Status |
|---|---|
| Manifest/quote validation and ranking | covered |
| Provider policy and signed quote | covered |
| Provider host side swap / close delegation | covered |
| Wallet funding witness + dApp rejection | covered in SDK/extension tests |
| Provider-funded open → pay → settle/close via LSP host adapter (AWS A/B test chain) | **PASS** 2026-11-25 |
| Consumer extension wallet ↔ provider host e2e | **not yet** |
| Wrong witness / wrong coin / replay / abort/timeout | partially; explicit tests pending |
| Live Axia hardened lease + coinproof path | **not yet** (opt-in live test skipped) |

### 4.1 Provider-funded LSP e2e — PASS (2026-11-25)

AWS A/B, solo test chain, current dist. The provider host auto-selected its own
funding coin; the consumer host accepted and paid; settlement/close completed
on-chain.

```text
provider coordinator-a 0x688D…BCF8
consumer coordinator-b 0x7B65…802F
provider funding address 0x8642BC6B… (1 test MIN, auto-selected)
channel 0xe443a85f7d3cde9b42f7ebfd9db29b90
initial provider 0.4 / consumer 0.6
pay 0.05 -> provider 0.45 / consumer 0.55
settlement 0x000033E50E5EFB43F71C56341ACE6875C02852B0810034A94FF3C03BD9C2B568
on-chain outputs: 0.45 -> provider, 0.55 -> consumer (block 57)
close -> both hosts report closed
OMNIA_LSP_RESULT {... "pass":true}
LSP_PASS
```

This proves the provider facade, host adapter, provider-funded auto-selection
and the 2-of-2 lifecycle. It does **not** yet prove the consumer extension's UI
quote/funding-witness flow.

## 5. Reproduce

```bash
cd totem-sdk
pnpm --filter @totemsdk/omnia-lsp test
pnpm --filter @totemsdk/omnia-lsp-provider test
pnpm --filter @totemsdk/omnia test
pnpm --filter @totemsdk/wots-lease test
```

Provider-funded LSP e2e against two hosts (test chain):

```bash
B_TRANSPORT_PUBKEY=0x… \
NODE_A=http://127.0.0.1:9015 NODE_B=http://127.0.0.1:9015 \
HOST_A=http://127.0.0.1:50055/rpc HOST_B=http://127.0.0.1:50056/rpc \
RPC_TOKEN=test MINIMA_RPC_PASSWORD=test LSP_NUDGE=1 LSP_CONTEST_DELAY=2 \
LSP_CONSUMER_AMOUNT=0.6 LSP_PROVIDER_AMOUNT=0.4 LSP_PAY_AMOUNT=0.05 \
node scripts/omnia-lsp-e2e.mjs
```

The live Axia lease test is opt-in and requires a funded test wallet/root key
and credentials:

```bash
# see tests/unit/wots-lease/src/__tests__/omnia-axia-live.test.ts
```

It is intentionally skipped by default. A passing Phase 1 acceptance run must
include it (or a documented equivalent) plus the two-party provider e2e.
