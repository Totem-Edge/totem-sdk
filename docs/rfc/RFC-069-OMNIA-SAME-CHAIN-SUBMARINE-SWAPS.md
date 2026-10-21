# RFC-069 — Omnia Same-Chain Submarine Swaps

**Status:** Proposed — implementation not started; same-chain profile only
**Priority:** P2 (liquidity and treasury)
**Created:** 2026-10-21
**Authors:** Totem SDK Contributors
**Depends on:** RFC-048 (Omnia primitives), RFC-055 (routing architecture), RFC-064 (off-chain principles), RFC-065 (multipart payments), RFC-066 (rebalancing)
**Touches:** `omnia`, `chain-provider`, `tx-builder`, `kissvm`, `omnia-host`
**Proposes:** A same-chain on-chain/channel swap. It does not authorise an
external-chain bridge, a new package or a production claim until accepted.

---

## 1. Problem

A merchant may want to move accumulated channel receipts to its on-chain treasury
without closing customer channels. A user holding only on-chain funds may want
channel purchasing power without a separate funding relationship. A submarine
swap links an on-chain conditional payment and a channel HTLC so that either both
legs complete or both refund.

The same-chain profile is the first target. A cross-chain swap is a different
protocol with independent chain identities, finality assumptions, hash functions
and refund domains. It MUST NOT be inferred from this RFC.

---

## 2. Scope

### 2.1 In scope

- One asset on the same Minima chain.
- On-chain funds exchanged for Omnia channel balance, or the reverse.
- A single maker and taker.
- Hashlock and timeout conditions on both legs.
- Refund and recovery paths.
- Quote, fee and confirmation semantics.
- Durable orchestration across restart.

### 2.2 Out of scope

- Cross-chain swaps or bridges.
- Cross-asset swaps within Minima.
- Multi-party liquidity pools.
- A new package.
- A production claim before real-node recovery evidence and RFC-063 gates.
- Replacing splice-based replenishment.

---

## 3. Terms

**On-chain leg:** a conditional on-chain output claimable by the taker or
refundable to the maker.

**Channel leg:** an Omnia HTLC that pays the maker or refunds the taker.

**Preimage:** the exact byte string whose hash unlocks both legs.

**Quote:** the agreed asset, amount, fee, hash, expiry and refund schedule.

**Maker:** the party providing on-chain liquidity or channel liquidity.

**Taker:** the party claiming the opposite leg.

---

## 4. Contract

Illustrative minimum fields:

```ts
type AmountAtoms = string;
type BlockHeight = string;
type DigestHex = string;

interface SwapQuote {
  protocol: "omnia.swap";
  version: 1;
  swapId: string;
  chainId: string;
  asset: { tokenId: string; scale: number };
  direction: "onchain-to-channel" | "channel-to-onchain";
  makerId: string;
  takerId: string;
  amount: AmountAtoms;
  fee: AmountAtoms;
  paymentHash: DigestHex;
  hashScheme: string;
  lockUntil: BlockHeight;
  refundAfter: BlockHeight;
  onchainRefundAddress: string;
  channelId?: string;
}
```

The quote MUST bind the exact asset identity, amount, fee, chain/genesis,
preimage hash scheme, lock and refund heights, and both parties. A ticker is not
an asset identity.

`paymentHash` MUST be over the exact preimage bytes. Hashing raw bytes and hashing
a UTF-8 hexadecimal representation are different operations and MUST NOT be
conflated.

---

## 5. Protocol

### 5.1 Quote and secret

1. The parties agree the quote and exact timeout margins.
2. One party generates the preimage and shares only its hash.
3. The other party verifies the hash scheme and byte encoding.
4. Both persist the quote before funding anything.

The secret generator MUST be explicit. A party that knows the preimage before the
other leg is funded is not a security failure by itself, but it changes which
party carries the funding risk and MUST be stated.

### 5.2 Fund the first leg

- **onchain-to-channel:** the maker funds the on-chain conditional output first.
- **channel-to-onchain:** the taker locks the channel HTLC first.

The funding transaction MUST be included and reach the agreed confirmation depth
before the second leg is committed. A mempool sighting is not confirmation.

### 5.3 Execute the second leg

1. Verify the first leg's exact script, amount, asset, hash and timeout.
2. Commit the second leg.
3. Claim the first leg with the preimage.
4. Record both claims and reconcile.

The timeout order MUST give the claiming party enough time to claim after the
second leg is committed, including worst-case inclusion and reorg margin.

### 5.4 Refund

If the second leg is not completed before its deadline, each party uses the
declared refund path. A refund MUST NOT be available while the counterparty can
still validly claim, and vice versa.

---

## 6. Invariants

1. Both legs settle, or both legs refund. A state where one party can claim both
   legs is invalid.
2. The preimage MUST match the exact hash and byte encoding in the quote.
3. A claim MUST NOT be valid on a different chain, asset or swap ID.
4. The on-chain leg MUST NOT be spendable by the maker after the taker has a valid
   claim.
5. The channel leg MUST NOT be claimable after its refund path is valid.
6. Timeout margins MUST account for worst-case inclusion and reorg, not a copied
   block count.
7. A restart MUST NOT create a second funding or a second claim.
8. A failed API response MUST NOT be treated as a failed swap.

---

## 7. State machine

```text
quoted
  -> first-leg-funded
  -> first-leg-confirmed
  -> second-leg-committed
  -> claimed
  -> reconciled

quoted | first-leg-funded | first-leg-confirmed
  -> refunding
  -> refunded

second-leg-committed | claiming
  -> recovering
  -> claimed | refunded
```

`confirmed` means the agreed confirmation depth, not merely broadcast. `claimed`
means both legs' claims are durable; it does not mean the channel is closed.

---

## 8. Failure and adversarial cases

Tests MUST cover:

- late inclusion of the first leg;
- a reorg after apparent confirmation;
- secret disclosure near expiry;
- fee spikes that delay inclusion;
- maker or taker disappearing at each stage;
- restart during funding, claim or refund;
- a preimage with the wrong byte encoding;
- a second claim attempt on either leg;
- a channel splice or close racing the swap;
- a quote with overlapping lock/refund heights;
- a malicious peer presenting a different asset or chain ID.

---

## 9. Evidence and acceptance

### 9.1 Required evidence

- A real same-chain swap on a real node, both directions.
- A test showing the refund path after the counterparty disappears.
- A near-expiry inclusion test and a reorg test.
- Restart during each stage.
- Exact amount, fee and confirmation accounting.
- A comparison with splice-based replenishment and ordinary channel payment.

### 9.2 Promotion gate

The profile may be called "implemented" only after real-node evidence for both
directions and both refund paths. It may not be called a bridge or a cross-chain
swap. Production labelling requires RFC-063 gates and custody review.

### 9.3 Kill criterion

Stop or redesign if:

- the timeout margins cannot be made safe under the chain's inclusion and reorg
  assumptions;
- a party can claim both legs or leave the other party without a refund;
- the swap is not cheaper or more useful than splice-based replenishment;
- the implementation depends on a mempool observation as finality.

---

## 10. Metrics

- success rate for both directions;
- confirmation latency and refund latency;
- capital locked and capital-time;
- fees versus splice and ordinary channel payment;
- failed/retried swaps;
- recovery time after crash or reorg;
- number of swaps requiring manual intervention.

---

## 11. Open questions

1. Which party should generate the preimage for each direction?
2. What confirmation depth and reorg margin are required on Minima?
3. Can the on-chain conditional output reuse an existing KISSVM template, or is a
   new reviewed template required?
4. How does a concurrent splice or channel close affect the refund schedule?
5. Should cross-asset same-chain swaps reuse this protocol or remain a separate
   profile?

---

## 12. Non-goals

- Cross-chain interoperability.
- A bridge or wrapped asset.
- Cross-asset swaps.
- A new package.
- Replacing splice-based replenishment.
- A production claim by documentation alone.
