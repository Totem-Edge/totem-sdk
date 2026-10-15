# Example: Meridian Pay — LP capital → VTXO payments → withdrawal

A worked, **runnable** end-to-end across `@totemsdk/liquidity-bond`,
`@totemsdk/omnia-pool`, and `@totemsdk/omnia-vtxo`. The executable version lives
at `packages/sdk-tests/test/scenarios/meridian-payments.scenario.test.ts`.

## The business

**Meridian** runs an Omnia node and wants merchants to accept MINIMA instantly by
paying via VTXOs (no per-payment on-chain fee). **Acme Capital** supplies the
liquidity behind that promise for a share of routing fees.

- Operator: Meridian (holds the operator key; co-signs VTXO mutations).
- LP: Acme Capital.
- End users: a shopper and a merchant.

## The three roles (say them like this)

| Package | One-line role | Owns | Holds value? |
|---|---|---|---|
| `@totemsdk/liquidity-bond` | The **receipt / ledger** | "Acme owns 25M of pool X" — position, receipt, allocation, fee and withdrawal records | No (data only) |
| `@totemsdk/omnia-pool` | The **fund manager** | The decisions: deploy, deposit, allocate, fees/NAV, rebalance, approved withdrawal | No (drives targets) |
| `@totemsdk/omnia-vtxo` | The **spendable balances** | The on-chain pool UTXO + the VTXOs users spend, and the per-share exit | Yes (on-chain script) |

They stack — `liquidity-bond` is the record layer, `omnia-pool` allocates capital
across execution backends (channels, factories, routers, splices, **VTXO pools**),
and `omnia-vtxo` is one of those backends plus the balances themselves:

```
liquidity-bond   position/receipt/allocation/fee ledger
      ▲
omnia-pool       LP capital pool: deploy → deposit → allocate → fees/NAV → withdraw
      │ allocates into →
      └── omnia-vtxo   VTXO payment pool (on-chain UTXO + claim tree + per-share exit)
```

The word "pool" means two different things: omnia-vtxo's pool is a **settlement
capacity UTXO** backing bearer claims; omnia-pool's pool is an **LP capital pool**
that allocates to targets. They compose — they do not duplicate.

## The flow (and which package acts)

1. **Deploy** — `omnia-pool.createOmniaPool(...)` writes the manifest via
   `liquidity-bond.createLiquidityPoolManifest` and registers it.
2. **Fund** — `omnia-pool.depositToPool(...)` → `commitToPool` → `acceptCommitment`
   (chain-verified funding) → `createPositionFromCommitment` → `issueLpReceipt`.
   Acme now holds a `LiquidityPosition` + `LiquidityReceipt` — the claim, not custody.
3. **Allocate** — `omnia-pool.allocatePositionCapital({ target: { type: 'vtxo', ... } })`
   → `omnia-vtxo.createPool(...)` + `mintVtxo(...)`: capital becomes a VTXO backed by
   the pool's on-chain output (`buildAndHashPoolScript` + `anchorBatch`).
4. **Spend** — `omnia-vtxo.transferVtxo(...)` / `splitVtxos` / `mergeVtxos`: bearer
   balances move off-chain, each mutation committed in the pool's Merkle epoch.
5. **Fees** — `omnia-pool.recordPoolFee(...)` → `liquidity-bond.recordLiquidityFee`;
   `computePoolNAV(...)` reports committed capital + accrued LP fees.
6. **Withdraw** — `liquidity-bond` pairs `withdrawLiquidity` → `approveWithdrawal`
   (gated), then `omnia-pool.executePoolPayout(...)` → `omnia-vtxo.createExitDraft`
   → a **per-share** exit (RFC-039): Acme withdraws only its committed share.

Run it:

```bash
cd packages/sdk-tests && pnpm test meridian-payments
```

## Other VTXO use cases (beyond simple payments)

VTXOs are "cash-like off-chain balances backed by a shared on-chain pool", and
splitting/merging/refresh are native — so anything that looks like **bearer
balances with settlement** fits.

- **Streaming / metered payments.** Mint a large VTXO, `splitVtxos` a tranche per
  tick (per second / per API call / per kWh). Pairs with the `kissvm` meter
  template; the pool refreshes what's left.
- **Prepaid transit & event passes.** A VTXO as a bearer ticket — split off a
  ride/seat, transferable peer-to-peer, expiring by pool epoch.
- **Loyalty / gift / merchant credit.** Off-chain bearer credit redeemable at any
  pool member; `mergeVtxos` to consolidate points, `splitVtxos` to redeem.
- **Micropayment aggregation for IoT.** Millions of tiny device payments collapse
  into epoch roots instead of on-chain dust; devices hold bearers, the operator
  anchors one root per epoch.
- **Payroll / allowance.** Employer mints an epoch's claim, splits into per-person
  VTXOs; recipients spend or transfer without a bank rail.
- **Escrow-lite / condition-gated bearers.** Split a VTXO whose transfer receipt
  is only co-signed by the operator once an off-chain condition (HTLC fulfillment,
  oracle attestation) holds — an "escrow" that isn't a separate UTXO.
- **Rollup-style batched settlement.** Use the pool as a generic batching lane:
  many users' transfers → one epoch anchor, with per-share exit as the escape
  hatch. This is the COINID/'1' "rollup lane" pattern, generalized to any asset.
- **Collateral / margin bearers.** Hold position margin as VTXOs; `refresh` keeps
  them current, per-share exit lets a trader pull collateral unilaterally.
- **Ticket / queueing (NFT-ish).** A VTXO as a transferable right to a scarce
  slot; the pool epoch is the freeze point.
- **Multi-asset pockets.** One pool per tokenId; a wallet holds a pocket per asset
  with the same split/merge/exit primitives.

The common shape: **many cheap off-chain balances, one periodic on-chain anchor,
and a per-share unilateral exit** so holders are never locked to the operator.
