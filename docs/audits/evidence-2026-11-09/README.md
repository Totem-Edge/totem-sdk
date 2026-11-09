# Funded cross-host execution — 2026-11-09

Environment: OCI `gheeklabs` account.

| Role | Instance | Public | Private |
|---|---|---|---|
| A | `mash-a1-bench2` | `132.226.129.201` | `10.0.0.210` |
| B | `mash-a1-native-b` | `132.145.29.115` | `10.0.0.55` |

- Fresh `hawk-node` solo chain on A: `-data /home/ubuntu/hawk-exec -port 9028 -rpc 9032 -solo -genesis -testchainlength 64`, genesis 1,000,000,000.
- Coordinators: non-custodial `scripts/omnia-noncustodial-host.mjs` (no host seed), wallets `scripts/omnia-wallet-service.mjs` on 51060/51061.
- Native DHT bootstrap `8146640f…@10.0.0.210:49737`; A on 49738, B on 49739.
- Test-only short contest delay (`OMNIA_ALLOW_SHORT_CONTEST_DELAY=1` on B, `CONTEST_DELAY_BLOCKS=2`).

## Results

1. `NONCUSTODIAL_OPEN_PASS` — channel `0x84bfabcc3afcdaf7221e86a7fb70a7da`, 60,000,000 / 40,000,000.
2. Pay 5,000,000 — both hosts sequence 1, 55,000,000 / 45,000,000.
3. `NONCUSTODIAL_SETTLE_PASS` — settlement `0x00005E957E7E3E624D46F8C55661E88170075BC496F68A4B1278F1A968CF0A79`.
4. Second channel `0xe80b253718788ab432af2cca8374c15b`, 33,000,000 / 22,000,000.
5. Five concurrent 1,000,000 payments — sequences 2,3,4,5,6; final 27,000,000 / 28,000,000 on both hosts.
6. Both coordinators restarted — sequence 6 and 27,000,000 / 28,000,000 reloaded from durable state.
7. `NONCUSTODIAL_SETTLE_PASS` — settlement `0x00002262A1281675B2D08EC5DC89E8F4BF1D3FD7961541CF97652F624A250F1C`.

## Defects found and fixed

- Acceptor-side proposal binding was inverted (acceptor is `remoteParty`, peer is `localParty`).
- Funding address/token comparison was case-sensitive.
- Acceptor never re-activated a `funding_pending` channel after confirmation.
- Concurrent payments read the same sequence and silently applied once; per-channel mutation lock added.
- Settlement on a short-delay test chain needs the documented test-only contest-delay seam.

## Node caveat

The solo chain build becomes fragile after roughly 50 blocks (cascade/super-parent
rejections). Each scenario above was run on a freshly reset solo chain. That is a
node-build issue, not an SDK settlement failure; the SDK open/pay/settle/concurrency
paths all completed before the chain degraded.
