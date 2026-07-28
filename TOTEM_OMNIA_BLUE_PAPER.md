# Omnia Payment Network — Blue Paper

**The P2P payment channel architecture that scales to billions of devices. Eltoo channels, multi-hop routing, channel factories, VTXO accounting, statechain prepaid passes, off-chain tokens, lending and borrowing, and privacy by design — the complete financial infrastructure for the machine economy.**

**Version:** 1.1
**Date:** 2026-07-28
**Status:** Active

---

## Table of Contents

1. [The Billion-Device Problem](#1-the-billion-device-problem)
2. [Core Channel: Eltoo State Machine](#2-core-channel-eltoo-state-machine)
3. [Multi-Hop Routing](#3-multi-hop-routing)
4. [Channel Factories](#4-channel-factories)
5. [Channel Splicing](#5-channel-splicing)
6. [VTXO Accounting Layer](#6-vtxo-accounting-layer)
7. [Statechain Prepaid Passes](#7-statechain-prepaid-passes)
8. [Statechain Entity Servers](#8-statechain-entity-servers)
9. [P2P Transport & Discovery](#9-p2p-transport--discovery)
10. [Lending, Borrowing & Liquidity Provision](#10-lending-borrowing--liquidity-provision)
11. [Off-Chain Tokens & Stablecoins](#11-off-chain-tokens--stablecoins)
12. [Privacy by Design & Transport Agnosticism](#12-privacy-by-design--transport-agnosticism)
13. [Real-World Payment Examples](#13-real-world-payment-examples)
14. [Scaling to Billions](#14-scaling-to-billions)
15. [The Full Eefi Stack](#15-the-full-eefi-stack)

---

## 1. The Billion-Device Problem

There are approximately 15 billion connected IoT devices on Earth today. By 2030, projections range from 30 to 50 billion. Every single one of these devices produces or consumes value — a temperature reading, a kilowatt-hour, a megabyte of bandwidth, a second of compute time, a door unlock, a package scan, a quality inspection.

Today, exactly zero of these devices can get paid for what they do.

The reason is architectural. Payment systems are designed for humans. They assume a browser, a credit card form, a bank account, a 3-day settlement window, a 2.9% + $0.30 fee. None of this works for a soil moisture sensor that needs to sell a €0.0001 reading to an irrigation controller 3,000 kilometres away.

The Omnia Payment Network solves this by inverting the architecture. Instead of routing every payment through a centralised processor, Omnia creates a **peer-to-peer mesh of payment channels** where devices pay each other directly. No intermediary. No settlement delay. No minimum transaction size. A sensor in a German field can open a channel with a data buyer in Tokyo, stream 10,000 readings at €0.0001 each, and settle the total of €1.00 in a single on-chain transaction — all without a payment processor, a bank, or a cloud server in the loop.

### 1.1 Why P2P Channels Scale

Centralised payment networks have a fundamental scaling limit: every transaction must pass through the centre. Visa processes ~65,000 transactions per second at peak. That's impressive for humans buying coffee. It's laughable for 50 billion devices streaming micropayments.

P2P channel networks have no centre. Two devices that want to transact open a channel directly. Their payments never touch a central server. The network's capacity grows with the number of channels, not with the capacity of a central switch. A network with 1 billion channels can process 1 billion concurrent payment streams — because each stream is independent.

This is the same architectural insight that made BitTorrent scale to millions of peers while centralised file servers collapsed under load. The Omnia Payment Network applies it to money.

### 1.2 The Package Family

The Omnia Payment Network is implemented across seven packages, each solving one part of the problem:

| Package | Function | Real-World Analogy |
|---------|----------|-------------------|
| `@totemsdk/omnia` | Core eltoo channel state machine | A bank account shared by two parties |
| `@totemsdk/omnia-router` | Multi-hop payment pathfinding | The SWIFT routing network |
| `@totemsdk/omnia-factory` | N-of-N group channels | A cooperative bank for a fleet of devices |
| `@totemsdk/omnia-splice` | Channel resizing without closing | Topping up or withdrawing from an account without closing it |
| `@totemsdk/omnia-vtxo` | Virtual UTXO accounting | A bearer note inside a shared liquidity pool |
| `@totemsdk/statechain` | Off-chain ownership transfer | A prepaid gift card that can be regifted |
| `@totemsdk/se-server` | Statechain Entity infrastructure | A notary that witnesses transfers without seeing the details |

---

## 2. Core Channel: Eltoo State Machine

### 2.1 Why Eltoo?

Most payment channel networks use a punishment model. If you try to cheat by broadcasting an old channel state, I can take all your money. This requires every participant to store revocation secrets for every previous state and watch the blockchain constantly for cheating attempts.

For a device with 512KB of RAM and intermittent connectivity, this is impossible.

**Eltoo eliminates punishment entirely.** Every channel state carries a monotonically increasing sequence number. The latest state always replaces any earlier one on-chain. No revocation secrets. No watchtower anxiety. No penalty transactions. A soil sensor can go offline for a week during a monsoon, come back, and safely continue operating its channel.

The KISSVM script that enforces this is elegantly simple:

```
LET SETTLEMENT=STATE(100)
LET SEQUENCE=STATE(101)
LET PREVSEQUENCE=PREVSTATE(101)
ASSERT MULTISIG(2 pkA pkB)
IF SETTLEMENT THEN
    IF SEQUENCE EQ PREVSEQUENCE AND @COINAGE GTE 256 THEN RETURN TRUE ENDIF
ELSE
    IF SEQUENCE GT PREVSEQUENCE THEN RETURN TRUE ENDIF
ENDIF
```

**Settlement path:** Both parties agree to close. The sequence must match the previous state (no updates happened after settlement was proposed). A 256-block cooldown gives time for disputes.

**Update path:** The new sequence is higher than the previous. That's it. The newer state wins. No punishment. No revocation keys. No watchtowers.

### 2.2 Channel Lifecycle

```
open → fund → active → update (repeat) → cooperativeClose | forceClose
```

**Open:** Two parties exchange public keys and agree on initial balances. A 2-of-2 WOTS multisig covenant is created. The funding script is deterministic from the sorted participant public keys.

**Fund:** One or both parties deposit funds into the channel's on-chain UTXO. The channel transitions to `active`.

**Update:** Either party proposes a new balance distribution. The counterparty co-signs. Both signatures are WOTS one-time signatures — each update consumes one signing slot per party. The channel has 4,096 slots total. At 95% exhaustion (3,891 updates), the channel warns and blocks further updates until settled or spliced.

**Cooperative close:** Both parties sign a settlement transaction. After a 256-block cooldown, the funds are distributed on-chain according to the final balances.

**Force close:** One party broadcasts the latest signed state unilaterally. The counterparty has the cooldown period to dispute with a newer state.

### 2.3 HTLCs: Atomic Multi-Hop

Hash Time-Locked Contracts (HTLCs) enable atomic payments across multiple channels. Alice pays Dave through Bob and Carol:

```
Alice ──HTLC(hash=H, timeout=1100)──→ Bob ──HTLC(hash=H, timeout=1000)──→ Carol ──HTLC(hash=H, timeout=900)──→ Dave
```

Dave reveals the preimage to Carol, claiming his payment. Carol reveals it to Bob. Bob reveals it to Alice. If any hop fails, all HTLCs time out and funds return to their senders. The timeouts decrease toward the recipient, giving each hop time to claim before the previous hop's HTLC expires.

### 2.4 WOTS Capacity Management

Every channel update consumes a WOTS signing slot. With 4,096 slots per channel, a device making one payment per minute exhausts its channel in ~2.8 days. This is where splicing and factories become essential — they reset the WOTS budget without closing the channel.

| Threshold | Slots Used | Behaviour |
|-----------|-----------|-----------|
| Normal | 0–3,071 | Updates proceed normally |
| Approaching | 3,072 (75%) | Warning emitted |
| Critical | 3,686 (90%) | Warning emitted |
| Near Exhaustion | 3,891 (95%) | Updates blocked; `CAPACITY_NEAR_EXHAUSTION` returned |
| Exhausted | 4,096 (100%) | `ChannelCapacityError` thrown |

---

## 3. Multi-Hop Routing

### 3.1 The Routing Problem

A sensor in Germany wants to sell data to a buyer in Japan. They don't have a direct channel. But the sensor has a channel with a local router. The router has a channel with a European hub. The hub has a channel with an Asian hub. The Asian hub has a channel with the buyer.

The Omnia Router finds this path automatically.

### 3.2 Pathfinding

The router builds an in-memory channel graph. Each edge has a `feeRate` (fee per unit of amount forwarded) and an `availableBalance`. Dijkstra's algorithm finds the path with the lowest total fee, then fewest hops.

```
Route: Sensor → Router DE (0.1%) → Hub EU (0.05%) → Hub ASIA (0.08%) → Buyer
Total fee: 0.23% of amount
Hops: 4
Estimated blocks: 8
```

### 3.3 Cross-Token Swaps

The buyer wants to pay in MINIMA. The sensor wants to receive in a Euro stablecoin. An intermediary node announces a swap rate: 1 MINIMA = 0.95 EURS. The router finds a path that includes the swap:

```
Buyer(MINIMA) → Hub ASIA → [SWAP: 1 MIN = 0.95 EURS] → Hub EU(EURS) → Sensor(EURS)
```

The swap uses two HTLCs with the same hashlock. The intermediary can only claim by revealing the preimage on both sides simultaneously — atomic cross-token settlement.

### 3.4 Router Economics

Router nodes earn fees on every forwarded payment. A router forwarding 1,000 MIN per day at 0.1% per hop with an average of 3 hops earns 3 MIN per day. At network scale, this becomes a meaningful revenue stream that incentivises liquidity provision and reliable infrastructure.

---

## 4. Channel Factories

### 4.1 The Factory Model

A solar farm with 50 inverters doesn't need 50 on-chain UTXOs. A channel factory creates one N-of-N multisig UTXO that backs all 50 devices. Each inverter opens **virtual channels** with customers entirely off-chain.

```
On-chain: 1 UTXO (50-of-50 multisig, 500 MIN)
Off-chain: 50 inverters × 4 customers each = 200 virtual channels
On-chain footprint: 1 transaction
```

Without factories: 200 on-chain UTXOs, 200 funding transactions, 200× the cost.

### 4.2 Virtual Channels

Virtual channels between factory participants open and close off-chain. The factory's on-chain UTXO is the backing collateral. Virtual channel state updates are signed by both participants and the factory's covenant enforces them.

When a participant wants to exit, the factory settles all affected virtual channels in a single on-chain transaction. The participant receives their allocated share. The remaining participants continue operating.

### 4.3 Factory Economics

| Participants | Virtual Channels | On-Chain UTXOs | Cost Reduction |
|-------------|-----------------|---------------|---------------|
| 10 | 45 | 1 | 97.8% |
| 50 | 1,225 | 1 | 99.9% |
| 100 | 4,950 | 1 | 99.98% |

The factory model is how Omnia scales to billions of devices. A single factory can back thousands of devices, each with dozens of customer channels. The on-chain footprint is constant regardless of how many virtual channels exist.

### 4.4 Real-World Factory Example: Electric Vehicle Charging Network

A charging network operator deploys 10,000 charging stations across Europe. Each station needs to accept payments from hundreds of drivers.

**Without factories:** 10,000 on-chain UTXOs. Every new station requires an on-chain transaction. Every driver who wants to charge must open a direct channel with the specific station they're visiting. A driver road-tripping across Europe needs channels with dozens of stations.

**With factories:** One factory per region (10 factories for Europe). Each factory backs 1,000 stations. Drivers open one channel with the regional factory. They can charge at any station in that region — the factory routes the payment to the correct station's virtual channel. The driver never needs to know which specific station they're connected to.

---

## 5. Channel Splicing

### 5.1 Why Splicing Matters

A channel is a long-lived relationship. A solar inverter might have a channel open with a regular customer for months. During that time:
- The customer wants to add more funds (splice in)
- The inverter operator wants to extract revenue (splice out)
- The channel's WOTS budget is running low (splice resets it)

Splicing does all of this without closing the channel. The channel's off-chain state continues uninterrupted. Only the on-chain UTXO changes.

### 5.2 Splice Mechanics

**Splice in:** A new on-chain UTXO is created with the adjusted total value. The additional funds come from the splicing party's on-chain wallet. The channel's sequence resets, giving a fresh 4,096 WOTS slots.

**Splice out:** A new on-chain UTXO is created with the reduced total value. The withdrawn funds go to the splicing party's specified on-chain address. The channel continues operating with the remaining balance.

**Quiesce requirement:** Before splicing, all in-flight HTLCs must be resolved. This prevents funds from being locked in HTLCs that reference the old channel state.

### 5.3 Real-World Splice Example: Cloud Compute Node

A GPU compute node charges €0.01 per second of inference time. A customer opens a channel with 100 MIN.

**Day 1:** Customer runs 500 seconds of inference (5 MIN). Channel balance: Customer 95 MIN, GPU 5 MIN.

**Day 30:** Customer has used 1,500 MIN worth of compute. They've spliced in funds 15 times. The GPU operator has spliced out 1,500 MIN in revenue. The channel has been open for a month. Zero downtime. Zero channel closures. The WOTS budget has been reset with each splice.

Without splicing, the channel would have closed and reopened 15 times — 30 on-chain transactions instead of 15 splices.

---

## 6. VTXO Accounting Layer

### 6.1 What is a VTXO?

A Virtual UTXO (VTXO) is a cash-like off-chain balance claim backed by a Merkle commitment tree. Think of it as a bearer note inside a shared liquidity pool.

The pool operator holds the on-chain UTXO. VTXO holders hold Merkle proofs. A VTXO can be minted, transferred, split, merged, refreshed, and exited — all without touching the blockchain.

### 6.2 VTXO Lifecycle

```
mint → active → transfer → active (new owner)
              → split → active (multiple pieces)
              → merge → active (combined)
              → refresh → active (new epoch)
              → exit → exited (on-chain claim)
```

**Mint:** Operator creates a VTXO from pool capacity. `pool.availableCapacity` decreases.

**Transfer:** Owner sends VTXO to a new owner. The old VTXO becomes `transferred`. A new VTXO is minted for the recipient. Pure functional — no live signing needed from the sender.

**Split:** One VTXO becomes many. A €10 VTXO splits into €7 and €3 VTXOs. Useful for making change.

**Merge:** Many VTXOs become one. Three €1 VTXOs merge into one €3 VTXO. Useful for consolidating small balances.

**Refresh:** Operator posts a new commitment root for a new epoch. All live VTXOs are refreshed against the new root. This is how the pool evolves over time.

**Exit:** Holder claims the on-chain funds. The VTXO is burned and the pool's on-chain UTXO is adjusted.

### 6.3 Why VTXOs Matter for Devices

VTXOs are **pure functional** — transfers don't require live signing from the sender. A device that's intermittently connected can receive VTXOs while offline and verify them when it reconnects. This is critical for:

- **Vending machines** that receive payments while offline
- **Agricultural sensors** that batch-sell data once a day when connectivity is available
- **Delivery drones** that receive VTXOs at pickup and verify them at drop-off
- **Maritime sensors** that operate for weeks without connectivity

### 6.4 Real-World VTXO Example: Vending Machine Network

A vending machine operator deploys 500 machines across a city. Each machine holds a VTXO pool with 1,000 MIN capacity.

**Customer buys a €2 snack:**
1. Customer's wallet holds a €5 VTXO from the operator's pool
2. Customer presents the €5 VTXO to the machine
3. Machine verifies the Merkle proof against the pool's commitment root
4. Machine splits the VTXO: €2 to machine, €3 change back to customer
5. Both new VTXOs are valid against the pool root
6. No on-chain transaction. No network connectivity required. Sub-second settlement.

**End of day:**
1. Machine has accumulated 200 VTXOs worth €340
2. Machine merges them into one €340 VTXO
3. Machine exits the VTXO to the operator's on-chain address
4. One on-chain transaction settles the entire day's revenue

500 machines × 1 on-chain settlement per day = 500 on-chain transactions for potentially 50,000 customer purchases. That's a 99% reduction in on-chain footprint.

---

## 7. Statechain Prepaid Passes

### 7.1 The Prepaid Pass Model

Not every payment is a continuous stream. Sometimes a customer wants to buy a fixed amount of service upfront — a 1-hour Wi-Fi pass, a 500MB bandwidth token, an event ticket, a door access credential.

Statechains enable this. A statechain is an off-chain UTXO whose ownership can be transferred without an on-chain transaction. A Statechain Entity (SE) issues blind co-signatures that authorise transfers without learning the UTXO value or the identities of the parties.

### 7.2 Statechain Lifecycle

```
create → lock UTXO with SE co-signature
       → transfer → new owner (SE blind-signs)
       → transfer → new owner (repeat)
       → claim → on-chain settlement
```

**Create:** Owner locks a UTXO with an SE co-signature. The KISSVM script requires `MULTISIG(2 owner SE)` for normal operation and `SIGNEDBY(owner)` after a reclaim timelock.

**Transfer:** Current owner proves ownership to the SE. SE issues a blind signature over the new owner's key. The transfer record includes the prior owner's WOTS signature for full chain-of-custody verification.

**Claim:** Current owner claims the UTXO on-chain with the SE's co-signature. Cooperative and fast.

**Reclaim:** If the SE goes offline, the original depositor can unilaterally reclaim after `RECLAIM_TIMELOCK` blocks (default: 2,016 blocks ≈ 2 weeks).

### 7.3 Blind Signatures: Privacy by Design

The SE signs what the new owner presents without seeing the content. The SE knows a transfer happened but learns nothing about:
- The UTXO value
- The identity of the sender
- The identity of the receiver
- What the statechain represents

This is critical for privacy. An SE operator cannot build a profile of who is buying what. They are a blind notary, not a surveillance intermediary.

### 7.4 Real-World Statechain Examples

**Airport Wi-Fi:**
A provider creates 10,000 statechains, each representing "1 hour of Wi-Fi access." Travelers buy them on-chain or off-chain. They present the statechain to the hotspot. The hotspot verifies the chain of custody off-chain and grants access. No captive portal. No credit card. No account creation.

**Public Transport:**
A city transit authority issues statechains as daily, weekly, and monthly passes. Commuters hold them in their Totem wallet. Tap to ride. The fare gate verifies the statechain off-chain. No ticket machine. No top-up kiosk. The pass is the proof.

**Event Ticketing:**
A festival issues 50,000 statechains as tickets. Attendees can resell them peer-to-peer — each transfer is a statechain transfer with an SE blind signature. The festival never learns who bought from whom. The venue gate verifies the statechain at entry. No Ticketmaster. No scalping bots. No counterfeit tickets.

**Content Licensing:**
A stock photo platform issues statechains as content licenses. A designer buys a license, uses the photo, and transfers the license to a client. The client can verify the chain of custody back to the original issuer. The platform earns a fee on every transfer.

**Hotel Key Cards:**
A hotel issues a statechain as a room key. The guest holds it in their wallet. The door lock verifies it off-chain. Check-out time expires the statechain automatically. No plastic key cards. No front desk queue.

**Supply Chain Custody:**
A pharmaceutical shipment changes hands 5 times from manufacturer to hospital. Each transfer is a statechain transfer. The hospital verifies the full chain of custody back to the manufacturer. Every transfer is cryptographically provable. No paperwork. No disputes about who had custody when.

---

## 8. Statechain Entity Servers

### 8.1 Self-Sovereign Infrastructure

Anyone can run an SE server. It's a Node.js application with a PostgreSQL database. Deploy it on a Raspberry Pi in your office, on a cloud VM, or on a bare-metal server in a colocation facility. The SE server:

- Derives its identity from a 32-byte WOTS seed
- Exposes a REST API for statechain operations
- Issues blind signatures without learning transfer details
- Encrypts reclaim transactions with its own key
- Announces itself to the SE Registry for discovery
- Competes on uptime, latency, and fees

### 8.2 SE Economics

SE operators set their fee in basis points. A 10 bps fee on a 100 MIN statechain transfer earns the operator 0.1 MIN. At 1,000 transfers per day, that's 100 MIN per day in revenue.

The SE Registry is a free market. Operators announce their fees, uptime SLA, and endpoint. Wallets discover SEs and choose based on price and reliability. Bad operators lose business. Good operators earn more.

### 8.3 SE Security

- **Key derivation:** `SHA3-256(seed || [0,0,0,0])` — deterministic from seed
- **Nonce-based auth:** Every mutating operation requires a nonce (expires 300s) + WOTS owner signature
- **Key revocation:** Old key revoked before new key registered — prevents double-spend
- **Reclaim TX encryption:** Stored encrypted with SE key; only decryptable by the SE
- **Timelock monitor:** Alerts for chains approaching reclaim window
- **Billing hook:** `onSign` callback fires on every signing event for credit deduction and audit logging

---

## 9. P2P Transport & Discovery

### 9.1 Hyperswarm DHT

The Omnia network uses Hyperswarm — a distributed hash table built on Holepunch's Pear stack — for peer discovery and messaging. Every device that wants to participate in the payment network joins the DHT.

**Channel discovery:** `SHA3-256('omnia:' + channelId)` → DHT topic. Both parties join the same topic and discover each other.

**Peer discovery:** `SHA3-256('omnia:peer:' + pubkey)` → DHT topic. A device announces itself and other devices can find it.

**Broadcast:** `SHA3-256(topic)` → DHT topic. For announcements, swap rates, and service discovery.

### 9.2 Three Relay Modes

Not every device can run a full DHT node. A constrained IoT sensor behind NAT has limited UDP access. Omnia supports three relay modes:

| Mode | Transport | Use Case |
|------|-----------|----------|
| **Native** | Raw Hyperswarm P2P over UDP | Node.js servers, Pear/Bare devices, anything with UDP access |
| **Hosted** | Axia-managed WebSocket relay | Browsers, serverless functions, restricted environments |
| **Self-hosted** | Your own `DhtRelayBridge` node | Air-gapped deployments, private networks, enterprise |

A soil sensor in a field with only LoRaWAN connectivity can use a self-hosted relay at the farm's edge gateway. The gateway bridges LoRaWAN to WebSocket. The sensor participates in the payment network through the relay.

### 9.3 Wire Protocol

All Omnia messages use a simple binary framing: 4-byte big-endian uint32 length prefix followed by a UTF-8 JSON body. This is compatible with `@totemsdk/lookup-protocol` framing, allowing Omnia messages to be embedded in lookup protocol messages for unified transport.

Message types: `CHANNEL_PROPOSAL`, `STATE_UPDATE`, `SETTLEMENT_PROPOSAL`, `ACK`, `ERROR`.

---

## 10. Lending, Borrowing & Liquidity Provision

The Omnia Payment Network is not just a payment rail. It is a **capital market**. Every channel holds locked funds. Every factory pools capital. Every VTXO pool is a shared liquidity reserve. These are the raw materials for a P2P lending and borrowing system that operates without banks, without credit scores, and without centralised intermediaries.

### 10.1 Flash Loans: Single-Transaction Borrowing

The `FlashCashHelper` in `@totemsdk/core` enables flash loans — borrow any amount of any token, use it across multiple operations, and repay it with interest, all within a single Minima transaction. If the loan is not repaid by the end of the transaction, the entire transaction reverts. The lender risks nothing. The borrower pays only if they succeed.

```
Transaction:
  1. Borrow 1,000 MIN from FlashCash pool
  2. Arbitrage: Buy token on DEX A, sell on DEX B
  3. Repay 1,000 MIN + 5 MIN interest to FlashCash pool
  4. Keep profit
  → All atomic. All in one transaction.
```

**Why this matters for Eefi:** A router node that needs temporary liquidity to forward a large payment can flash-borrow the amount, execute the multi-hop payment, collect the routing fee, and repay the loan — all atomically. The router never needs to hold large balances. Liquidity is available on demand.

### 10.2 Liquidity Bonds: The Capital Layer

`@totemsdk/liquidity-bond` provides the deterministic accounting layer for productive liquidity. Liquidity Providers (LPs) commit MINIMA (or accepted tokens like MxUSD) to pools. The pool operator allocates this capital to route-reserves, channel-capacity, factory-capital, or RFQ-inventory. Every allocation is recorded. Every fee is tracked. Every position has a risk haircut.

**The lending model emerges naturally:**

| Traditional Finance | Omnia Equivalent |
|---------------------|------------------|
| Bank deposit | LP commitment to a liquidity pool |
| Bank lending to businesses | Pool operator allocating capital to channel factories |
| Interest on deposits | LP fee share from routing fees and swap spreads |
| Loan collateral | MINIMA locked in provider bonds |
| Credit score | Provider bond score (identity + collateral + reliability) |
| Loan default | Provider bond slashing via KISSVM challenge |
| Early withdrawal penalty | `earlyWithdrawalPenaltyBps` on LP positions |

**How it works in practice:**

1. Alice has 10,000 MIN sitting idle. She commits it to a router liquidity pool.
2. The pool operator allocates 8,000 MIN to channel-capacity (after 20% risk haircut).
3. Bob's router node uses this capital to forward payments, earning 0.1% per hop.
4. The pool collects routing fees: 5 MIN per day.
5. Alice earns 80% of fees (LP share): 4 MIN per day. The operator earns 20%: 1 MIN per day.
6. Alice's effective APY: 4 MIN × 365 / 10,000 MIN = 14.6% annualised.

This is lending, but P2P and channel-native. Alice's capital enables Bob's router to forward payments. Bob's routing fees pay Alice's yield. No bank. No credit committee. No loan documents. Just cryptographic commitments and deterministic fee accounting.

### 10.3 VTXO Pools as Lending Pools

A VTXO pool is structurally identical to a lending pool. The pool operator holds the on-chain UTXO (the "deposits"). VTXO holders hold Merkle proofs (the "loan notes"). The pool earns fees from the economic activity it enables. VTXO holders can exit to claim their share of the pool.

**The VTXO lending model:**

1. A stablecoin issuer creates a VTXO pool with 1,000,000 MxUSD capacity
2. Merchants mint MxUSD VTXOs by depositing MINIMA collateral into the pool
3. The pool operator allocates the MINIMA collateral to channel factories, earning routing fees
4. Merchants use their MxUSD VTXOs to pay suppliers, who can hold them, transfer them, or exit them for MINIMA
5. The pool's fee revenue is distributed to VTXO holders pro-rata
6. A merchant holding 10,000 MxUSD in VTXOs earns yield on their balance — without lending it to a bank

This is a **collateralised stablecoin** where the collateral is productive (earning routing fees) rather than idle (sitting in a vault). The stablecoin is backed by MINIMA, but the MINIMA is working.

### 10.4 Channel Factories as Credit Unions

A channel factory is a cooperative pool. Participants contribute capital. They lend to each other via virtual channels. The factory's on-chain UTXO is the shared collateral. Virtual channel balances are the loans.

**The factory lending model:**

1. 50 solar inverters join a factory, each contributing 100 MIN
2. The factory has 5,000 MIN total capacity
3. Inverter 7 needs to pay a maintenance contractor 200 MIN but only has 50 MIN in its virtual channel
4. The factory reallocates 150 MIN from Inverter 3 (which has surplus) to Inverter 7
5. Inverter 7 pays the contractor. Inverter 7 now owes 150 MIN to the factory pool.
6. Over the next week, Inverter 7's revenue repays the factory pool
7. Inverter 3 earns a small interest rate on the lent 150 MIN

This is peer-to-peer lending within a cooperative. No bank. No loan application. The factory covenant enforces the terms. The recursive MAST policy tree ensures every participant operates within their mandated authority.

### 10.5 KISSVM Enforcement Layer

The KISSVM `rwa-lifecycle` template provides the on-chain enforcement for yield distribution with `distributionType: 'interest'`. The `treasury` template provides time-locked reserves with linear vesting. The `liquidity-bond` template enforces lock terms, fee accrual, and withdrawal conditions.

These templates are the legal contracts of the Omnia capital market. They are not legal prose interpreted by courts. They are KISSVM scripts executed deterministically by the Minima virtual machine. A loan that is not repaid does not go to collections — it is slashed from the borrower's provider bond.

### 10.6 How This Differs from Aave and Compound

| Property | Aave / Compound | Omnia Lending |
|----------|----------------|---------------|
| Pool model | Centralised smart contract | P2P channel-native |
| Collateral | On-chain tokens only | MINIMA provider bonds + channel balances |
| Oracle dependency | Required (price feeds) | None (collateral is native MINIMA) |
| Interest rate | Algorithmic (utilisation curve) | Market-determined (LP fee share) |
| Borrowing | Over-collateralised | Flash loans + factory reallocation |
| Privacy | All positions on-chain | Off-chain state updates, blind SE signatures |
| Counterparty risk | Smart contract risk | Provider bond slashing + KISSVM enforcement |

---

## 11. Off-Chain Tokens & Stablecoins

Omnia is token-agnostic. Any Minima token — native MINIMA, standard tokens, NFTs — can flow through channels, be locked in statechains, and be represented as VTXOs. This is not a future feature. It is how the protocol works today.

### 11.1 How Tokens Flow Through Omnia

Every Omnia channel has a `tokenId` field. A channel denominated in `0x00` carries MINIMA. A channel denominated in a custom token ID carries that token. The eltoo state machine, HTLC atomicity, and balance conservation work identically regardless of the token.

Cross-token swaps use dual HTLCs with the same hashlock. Alice pays in MINIMA. Bob receives in EURS. The intermediary provides liquidity in both tokens. The swap is atomic — either both sides settle or neither does.

```
Alice(MINIMA) ──HTLC(hash=H)──→ Intermediary ──HTLC(hash=H)──→ Bob(EURS)
```

The intermediary can only claim by revealing the preimage on both sides simultaneously. This is the mechanism that enables any token to flow through the Omnia network.

### 11.2 MxUSD: The Stable Settlement Asset

`@totemsdk/liquidity-bond` explicitly references MxUSD as an accepted asset for stable settlement pools. A liquidity pool denominated in MxUSD provides stable-value routing capacity. Merchants who want to receive stable-value payments open MxUSD channels. Customers who hold MINIMA route through a swap intermediary.

**The MxUSD flow:**

1. A stablecoin issuer mints MxUSD against MINIMA collateral locked in a VTXO pool
2. A merchant opens an MxUSD channel with a router node
3. A customer wants to pay the merchant 100 MxUSD but holds MINIMA
4. The router finds a cross-token route: Customer(MINIMA) → Swap Node → Merchant(MxUSD)
5. The swap node provides the MINIMA/MxUSD exchange rate
6. Dual HTLCs execute atomically: Customer pays MINIMA, Merchant receives MxUSD
7. The merchant never touches MINIMA. The customer never touches MxUSD. The swap node earns the spread.

### 11.3 VTXOs as Tokenized Off-Chain Assets

A VTXO can represent anything. It is a Merkle-proofed claim on a pool. The pool can hold MINIMA, MxUSD, or any token. The VTXO inherits the pool's token type.

**What VTXOs can represent:**

| VTXO Type | Pool Asset | Use Case |
|-----------|-----------|----------|
| Stablecoin balance | MxUSD | Merchant working capital |
| Tokenized RWA share | Tokenised real-world asset | Fractional ownership of a solar farm |
| Loyalty point | Brand token | Airline miles, coffee shop stamps |
| Invoice | MINIMA | Trade finance — tokenised receivables |
| Carbon credit | Carbon token | Verifiable emissions offsets |
| Gaming asset | Game token | In-game currency, transferable between players |

Every VTXO is transferable off-chain. Every VTXO is splittable and mergeable. Every VTXO is verifiable against the pool's Merkle root. The pool operator never needs to know what the VTXOs represent — they just maintain the commitment tree.

### 11.4 Statechains as Tokenized Bearer Instruments

A statechain is a bearer instrument. The holder of the statechain owns the underlying UTXO. Transferring the statechain transfers ownership. The SE blind-signs each transfer without learning what the statechain represents.

**What statechains can represent:**

| Statechain Type | Underlying Asset | Use Case |
|-----------------|-----------------|----------|
| Prepaid Wi-Fi pass | MINIMA | 1-hour airport Wi-Fi access |
| Event ticket | MINIMA | Festival entry, transferable peer-to-peer |
| Gift card | MINIMA | Coffee shop credit, regiftable |
| Water right | MINIMA | Seasonal irrigation allocation |
| Content license | MINIMA | Stock photo usage right |
| Hotel key | MINIMA | Room access, expires at check-out |
| Transport pass | MINIMA | Daily/weekly/monthly transit pass |
| Digital collectible | NFT | Transferable digital art or memorabilia |

The statechain is the token. There is no separate token contract. The statechain's chain of custody is the ownership registry. The SE's blind signatures are the transfer authorisations. The KISSVM locking script is the token's rules.

### 11.5 The Vision: A Euro Stablecoin on Omnia

A European fintech company wants to issue a Euro stablecoin (EURS) on Minima. They want it to be used for everyday payments — coffee, groceries, utility bills. They want it to be private. They want it to earn yield.

**The Omnia implementation:**

1. The issuer creates a VTXO pool with 10,000,000 EURS capacity, backed by MINIMA collateral
2. Users mint EURS VTXOs by depositing MINIMA into the pool
3. The pool's MINIMA collateral is allocated to channel factories, earning routing fees
4. EURS VTXO holders earn yield from the pool's fee revenue
5. Merchants accept EURS via Omnia channels — customers pay in MINIMA, the router swaps to EURS atomically
6. EURS VTXOs transfer off-chain between users — no on-chain transaction, no gas fee, instant settlement
7. The SE server issues statechain-based EURS prepaid cards for offline payments
8. The entire system is private — channel states are off-chain, VTXO transfers are pure functional, statechain transfers are blind-signed

This is a stablecoin that is private, yield-bearing, and usable for everyday payments — without a centralised payment processor, without KYC on every transaction, and without the stablecoin issuer ever learning who is paying whom.

---

## 12. Privacy by Design & Transport Agnosticism

The Omnia Payment Network is private by default. Not because of a privacy add-on. Because the architecture itself minimises the surveillance surface.

### 12.1 The Privacy Stack

**Layer 1 — Off-chain state updates.** Every channel state update happens off-chain between the two parties. Only cooperative settlement or unilateral force-close touches the Minima blockchain. A channel that runs for a year with 10,000 updates produces one on-chain transaction. The 9,999 intermediate states are known only to the two parties.

**Layer 2 — Eltoo eliminates watchtowers.** Lightning Network requires watchtowers — third parties that monitor the blockchain for cheating attempts. Watchtowers are surveillance points. Eltoo eliminates punishment entirely, which eliminates watchtowers. No third party monitors your channels.

**Layer 3 — Statechain blind signatures.** The Statechain Entity signs what the new owner presents without seeing the content. The SE knows a transfer happened but learns nothing about the UTXO value, the identities of sender or receiver, or what the statechain represents. The SE is a blind notary, not a surveillance intermediary.

**Layer 4 — VTXO pure functional transfers.** VTXO transfers don't require live signing from the sender. The recipient just needs the Merkle proof. No on-chain footprint. No network call. No third party observes the transfer. Two parties can exchange VTXOs in person, via Bluetooth, with zero external visibility.

**Layer 5 — MAST keeps inactive branches hidden.** Recursive MAST policy trees only reveal the executed branch. The other branches — alternative payment conditions, fallback scripts, emergency paths — remain hidden. An observer sees only the specific rule that was triggered, not the entire policy tree.

**Layer 6 — KISSVM data privacy templates.** The `data-privacy` KISSVM template provides ZK proof integration (`buildZkProofIntegrationScript`), GDPR-compliant subject requests (`buildGdprSubjectRequestScript`), and time-locked data escrow (`buildDataEscrowScript`). These are on-chain enforceable privacy guarantees.

**Layer 7 — Self-hosted infrastructure.** Every component can be self-hosted: SE server, lookup node, DHT relay. No data flows through Axia servers unless the user chooses hosted mode. An air-gapped deployment with a self-hosted relay and a local SE server has zero external data exposure.

### 12.2 What Omnia Does NOT Reveal

| Information | Visible to Counterparty | Visible to SE | Visible to Routers | Visible on L1 |
|-------------|------------------------|---------------|-------------------|---------------|
| Channel existence | Yes | No | Only if routing | Only on settlement |
| Channel balances | Yes | No | Only if routing | Only on settlement |
| Individual payments | Yes | No | Only if routing | Never |
| Statechain value | No (blind) | No (blind) | No | Only on claim |
| Statechain parties | No (blind) | No (blind) | No | Only on claim |
| VTXO transfers | No (pure functional) | No | No | Only on exit |
| Policy tree branches | Only executed branch | No | No | Only executed branch |

### 12.3 Transport Agnosticism: Reach Every Device

The most radical property of the Omnia Payment Network is not its privacy. It is its reach. Omnia can touch any device on Earth because it makes zero assumptions about how that device connects to the network.

**The port injection pattern.** No Omnia package imports a network library. Not `mqtt.js`. Not `modbus-serial`. Not `socketcan`. Not `noble`. Not `rclnodejs`. Not `node-opcua`. Not `node-bacnet`. Not the Matter SDK. Every protocol adapter defines a **transport port interface** — a clean contract that the caller implements for their environment.

This means the same Omnia channel code works identically whether the transport is:
- Hyperswarm DHT over UDP (a server in a data centre)
- WebSocket relay (a browser wallet)
- LoRaWAN bridge (a soil sensor in a field)
- Bluetooth LE (a vending machine)
- CAN bus (a vehicle)
- MQTT (a factory PLC)
- In-memory (a unit test)

**The three relay modes** provide connectivity for every environment:

| Mode | Transport | Who Uses It |
|------|-----------|-------------|
| **Native** | Raw Hyperswarm P2P over UDP | Servers, Pear/Bare devices, anything with UDP |
| **Hosted** | Axia-managed WebSocket relay | Browsers, serverless, restricted networks |
| **Self-hosted** | Your own `DhtRelayBridge` node | Air-gapped deployments, private networks, enterprise |

**A concrete example of reach:**

A soil moisture sensor in a Kenyan field has only LoRaWAN connectivity. It cannot run a DHT node. It cannot open a WebSocket. It can only send small packets over long distances.

1. The farm's edge gateway runs a self-hosted DHT relay
2. The gateway bridges LoRaWAN to the relay's WebSocket interface
3. The sensor sends readings to the gateway over LoRaWAN
4. The gateway publishes proofs to the Omnia network via the relay
5. A data buyer in London discovers the sensor via the lookup network
6. The buyer opens an Omnia channel with the sensor — through the gateway relay
7. Payments flow. The sensor never touched the internet.

This is what transport agnosticism means in practice. The sensor participates in a global payment network using only LoRaWAN. The GPU node in a London data centre participates using Hyperswarm DHT. They are in the same network. They can pay each other. The transport is an implementation detail.

### 12.4 The Full Reach Matrix

| Device | Connectivity | Transport | Omnia Participation |
|--------|-------------|-----------|-------------------|
| Cloud server | Fibre | Native Hyperswarm | Full DHT node, routing, factory |
| Browser wallet | HTTPS | Hosted WebSocket relay | Channel open, pay, settle |
| Smartphone | 4G/5G | Native or hosted | Full wallet, channel management |
| Raspberry Pi | Wi-Fi | Native Hyperswarm | SE server, lookup node, relay |
| Solar inverter | Wi-Fi/Ethernet | Native or self-hosted | Channel endpoint, MachinePay |
| Vending machine | BLE + occasional Wi-Fi | Self-hosted relay via BLE gateway | VTXO verification, offline operation |
| Soil sensor | LoRaWAN | Self-hosted relay via LoRaWAN gateway | Proof publication, channel endpoint |
| Vehicle | CAN bus + 4G | Self-hosted relay via CAN gateway | Channel endpoint, statechain verification |
| Factory PLC | Modbus TCP | Self-hosted relay via edge gateway | MachinePay, proof publication |
| Smart lock | BLE + Thread | Self-hosted relay via Thread border router | Statechain verification, offline operation |

Every device on this list can send and receive payments through the Omnia Payment Network. The transport is injected. The channel logic is identical. The privacy guarantees are identical. The network reaches everywhere because it demands nothing from the transport layer.

---

## 13. Real-World Payment Examples

The Omnia Payment Network is not a theoretical construct. Every mechanism described above exists in working code. Here is how they compose to touch payments across the real world.

### 13.1 Energy: Peer-to-Peer Solar Trading

**The setup:** A neighbourhood of 200 homes, 80 with rooftop solar. Each solar home generates surplus during the day. Each non-solar home needs power. The local utility pays €0.04/kWh for feed-in. Neighbours are willing to pay €0.08/kWh — double what the utility pays, half what the utility charges.

**The Omnia solution:**
1. Each solar home runs a Totem Edge node on their smart meter
2. The 80 solar homes join a channel factory — one on-chain UTXO backs all 80
3. Each non-solar home opens a virtual channel with the factory
4. Every 5 minutes, the smart meter reads production and consumption
5. Surplus production triggers a channel update: Solar Home 7 sends 0.5 kWh to Neighbour 42 at €0.08/kWh = €0.04
6. At the end of the month, the factory settles: each solar home receives their revenue, each non-solar home pays for what they consumed
7. The utility never touched the transaction. No utility billing system. No payment processor.

**Scale:** 200 homes × 288 five-minute intervals per day = 57,600 channel updates per day. All off-chain. One factory settlement per month. On-chain footprint: 1 transaction per month for the entire neighbourhood.

### 13.2 Mobility: Electric Vehicle Roaming Charging

**The setup:** A driver road-trips from Berlin to Barcelona. They need to charge at 8 different charging stations operated by 5 different companies. They don't have accounts with any of them.

**The Omnia solution:**
1. The driver's Totem wallet holds MINIMA and a VTXO from a European charging pool
2. At each station, the driver's wallet discovers the station via the lookup network
3. The station's manifest declares: €0.35/kWh, Omnia accepted, provider bond score 94/100
4. The wallet opens a virtual channel through the regional charging factory
5. As the car charges, the station meters kWh and triggers channel updates
6. When the driver unplugs, the channel settles cooperatively
7. The driver paid 8 different companies without creating 8 accounts, without entering a credit card 8 times, without waiting for 8 settlement periods

**Scale:** 10,000 charging stations across Europe, each serving 50 drivers per day = 500,000 channel opens per day. With regional factories (10 factories for Europe), on-chain footprint: 10 factory UTXOs. All 500,000 daily sessions are virtual channels within those factories.

### 13.3 Logistics: Cold Chain Compliance Payments

**The setup:** A pharmaceutical shipment travels from a manufacturer in Switzerland to a hospital in Nigeria. It passes through 4 warehouses, 2 customs checkpoints, and 3 transport legs. The shipment must stay between 2°C and 8°C for the entire journey. If it doesn't, the hospital doesn't pay.

**The Omnia solution:**
1. The manufacturer locks 10,000 MIN in a statechain representing the shipment value
2. A temperature sensor in the shipping container records readings every 60 seconds
3. Each reading is a WOTS-signed proof published to the lookup network
4. At each custody transfer, the statechain transfers to the next party with an SE blind signature
5. The recursive MAST policy tree enforces: temperature must stay in range, custody must follow the authorised chain, each party must sign within their mandated scope
6. At the hospital, the statechain is verified: 7 transfers, all valid, 43,200 temperature readings, all in range
7. The hospital claims the statechain on-chain. The 10,000 MIN is released to the manufacturer
8. If any reading was out of range, the statechain would be disputed and the funds returned to the hospital

**Scale:** 100 million pharmaceutical shipments per year globally. Each shipment generates ~43,000 proofs over a 30-day journey. 4.3 trillion proofs per year. All off-chain. Only disputed shipments touch L1.

### 13.4 Agriculture: Sensor Data Marketplace

**The setup:** 10,000 soil moisture sensors across farms in Kenya. Each sensor takes a reading every 15 minutes. An agricultural AI company in London wants to buy all readings for their crop yield prediction model. They're willing to pay €0.0001 per reading.

**The Omnia solution:**
1. The 10,000 sensors join a channel factory operated by a local agricultural cooperative
2. The AI company opens a virtual channel with the factory, depositing 100 MIN
3. Every 15 minutes, each sensor takes a reading, signs it with WOTS, and publishes it as a proof
4. The factory aggregates readings and triggers a channel update: 10,000 readings × €0.0001 = €1.00
5. The AI company's wallet auto-approves (amount is below their agent policy threshold)
6. At the end of each day, the cooperative splices out the day's revenue and distributes it to farmers

**Scale:** 10,000 sensors × 96 readings per day = 960,000 proofs per day. One channel update per aggregation interval. One factory splice per day. On-chain footprint: 1 transaction per day for 10,000 sensors.

### 13.5 Telecommunications: Mesh Network Bandwidth Market

**The setup:** A decentralised wireless mesh network in a rural community. 500 homes run mesh nodes. Each node can relay traffic for its neighbours. Bandwidth is a shared resource. Nodes that relay more traffic should earn more.

**The Omnia solution:**
1. Each mesh node runs a Totem Edge node
2. Nodes form a channel factory — one on-chain UTXO backs the entire mesh
3. Each node opens virtual channels with its direct neighbours
4. When Node A relays traffic for Node B, the usage meter tracks bytes forwarded
5. Every 10MB forwarded triggers a channel update: Node B pays Node A 1 satoshi per MB
6. At the end of each week, the factory settles: nodes that relayed more traffic receive more MINIMA
7. Nodes that consumed more bandwidth pay more

**Scale:** 500 nodes × 24 virtual channels per node = 12,000 virtual channels. One factory UTXO. Millions of channel updates per day. All off-chain. One weekly settlement.

### 13.6 Retail: Autonomous Vending Machine Network

**The setup:** 5,000 vending machines across a country. Each machine sells snacks and drinks. Prices range from €1 to €5. The operator wants zero payment processing fees and instant settlement.

**The Omnia solution:**
1. Each machine holds a VTXO pool with 500 MIN capacity
2. Customer approaches machine, wallet discovers it via BLE
3. Customer selects a €2 snack
4. Customer's wallet holds a €5 VTXO from the machine's pool
5. Machine verifies the VTXO's Merkle proof, splits it: €2 to machine, €3 change to customer
6. Machine dispenses snack. Total time: <1 second. No network connectivity required.
7. At end of day, machine merges all VTXOs and exits to operator's on-chain address

**Scale:** 5,000 machines × 100 transactions per day = 500,000 VTXO operations per day. 5,000 on-chain settlements per day (one per machine). 99% reduction in on-chain footprint vs. 500,000 individual transactions.

### 13.7 Media: Pay-Per-Second Streaming

**The setup:** A video platform wants to charge viewers per second watched instead of a monthly subscription. A viewer watches 47 seconds of a video and decides it's not for them. They should pay for 47 seconds, not a full month.

**The Omnia solution:**
1. Viewer opens an Omnia channel with the platform, depositing 10 MIN
2. As the video plays, the player triggers a channel update every 5 seconds: Viewer pays 0.0001 MIN per second
3. If the viewer closes the video after 47 seconds, the channel has updated 10 times. Total paid: 0.0047 MIN
4. The channel remains open for the next video. No new channel needed.
5. At the end of the browsing session, the channel closes cooperatively

**Scale:** 1 million concurrent viewers × 1 channel update per 5 seconds = 200,000 channel updates per second across the network. All off-chain. Each viewer has one channel. The platform's factory backs all viewer channels with a single on-chain UTXO.

### 13.8 Industrial: Machine-as-a-Service

**The setup:** A factory needs a specialised CNC machine for a 3-day production run. Buying one costs €500,000. The factory wants to rent one. A machine owner 200km away has one sitting idle.

**The Omnia solution:**
1. Machine owner lists the CNC machine on the lookup network: €50/hour, Omnia accepted
2. Factory discovers the machine, verifies its manifest and provider bond (score: 96/100)
3. Factory opens an Omnia channel with 5,000 MIN deposited (covers 100 hours of use)
4. Machine's edge runtime tracks operating hours via Modbus
5. Every hour of operation triggers a channel update: Factory pays 50 MIN to Machine Owner
6. The recursive MAST policy enforces: machine must be operated within specified parameters, maintenance schedule must be followed, operator must be certified
7. After 3 days (72 hours), the factory has paid 3,600 MIN. The channel closes. The remaining 1,400 MIN returns to the factory.

**Scale:** Millions of industrial machines worldwide. Each machine listed on the lookup network with a manifest, a price, and a provider bond. Factories rent capacity on demand instead of buying machines that sit idle 80% of the time.

### 13.9 Compute: Decentralised GPU Cloud

**The setup:** 100,000 gaming PCs with powerful GPUs sit idle overnight. An AI startup needs 10,000 GPU-hours for a training run. They can't afford AWS.

**The Omnia solution:**
1. Each gaming PC runs a Totem Edge node. GPU owner lists it on the lookup network: €0.20/GPU-hour, Omnia accepted
2. The AI startup's job scheduler discovers available GPUs via the lookup network
3. The scheduler opens channels with 10,000 GPUs through regional factories
4. Each GPU receives inference jobs, executes them, and triggers channel updates per second of compute time
5. The QVAC agent monitors GPU availability and dynamically adjusts pricing based on demand
6. At job completion, all channels settle. The AI startup paid €2,000 for 10,000 GPU-hours. AWS would have charged €15,000.

**Scale:** 100,000 GPUs × 1 channel update per second = 100,000 channel updates per second. Regional factories (100 factories for 100,000 GPUs). On-chain footprint: 100 factory UTXOs. All compute payments are off-chain.

### 13.10 Water: Smart Irrigation Marketplace

**The setup:** A river basin has 5,000 farms sharing water rights. Each farm has a water allocation. During drought, farms with surplus allocation can sell to farms with deficit. The water authority needs auditable records of every transfer.

**The Omnia solution:**
1. Each farm's irrigation controller runs a Totem Edge node
2. Water rights are represented as statechains issued by the water authority
3. Farm A has 10,000m³ allocation but only needs 7,000m³ this season
4. Farm A transfers a 3,000m³ statechain to Farm B via an SE blind signature
5. Farm B's irrigation controller verifies the statechain and opens the valve for 3,000m³
6. Payment flows through an Omnia channel: Farm B pays Farm A €0.10/m³ = €300
7. The water authority audits all transfers via the proofgraph — every statechain transfer is cryptographically verifiable

**Scale:** 5,000 farms × seasonal transfers. Statechain operations are off-chain. Only disputed transfers or end-of-season settlement touch L1.

---

## 14. Scaling to Billions

### 14.1 The Architecture of Scale

The Omnia Payment Network scales through three architectural properties:

**1. Horizontal scaling via P2P channels.** Every new device adds capacity to the network, not load on a central server. A network with 1 billion channels can process 1 billion concurrent payment streams because each stream is independent.

**2. Vertical scaling via channel factories.** One on-chain UTXO backs thousands of devices. The on-chain footprint grows logarithmically with the number of devices, not linearly.

**3. Temporal scaling via splicing.** Long-running channels never need to close. The WOTS budget resets with each splice. A channel between two devices can run for years, processing millions of payments, with periodic splices to extract revenue and add funds.

### 14.2 The Numbers

| Network Scale | Devices | Factories | Virtual Channels | Daily Updates | On-Chain TXs/Day |
|--------------|---------|-----------|-----------------|---------------|-----------------|
| Neighbourhood | 200 | 1 | 200 | 57,600 | 0.03 (monthly) |
| City | 10,000 | 10 | 50,000 | 14,400,000 | 10 |
| Country | 1,000,000 | 1,000 | 50,000,000 | 1,440,000,000 | 1,000 |
| Continent | 100,000,000 | 10,000 | 5,000,000,000 | 144,000,000,000 | 10,000 |
| Global | 1,000,000,000 | 100,000 | 50,000,000,000 | 1,440,000,000,000 | 100,000 |

At global scale, 100,000 on-chain transactions per day is well within Minima's capacity. The 1.44 trillion daily channel updates are entirely off-chain — they never touch L1.

### 14.3 Why This Beats Centralised Payment Networks

| Property | Visa/Mastercard | Omnia Payment Network |
|----------|----------------|----------------------|
| Architecture | Centralised switch | P2P mesh |
| Scaling model | Vertical (bigger servers) | Horizontal (more channels) |
| Minimum transaction | ~$0.01 (practical) | 1 satoshi (0.00000001 MIN) |
| Settlement time | 1-3 days | Instant (off-chain), 256 blocks (on-chain) |
| Fee model | 1.5-3.5% + $0.10-0.30 | 0.1% per routing hop |
| Device-to-device | Not supported | Native |
| Offline operation | No | Yes (VTXOs, statechains) |
| Quantum resistance | No | Yes (WOTS+) |
| Censorship resistance | No (centralised) | Yes (P2P) |

### 14.4 The Path to Billions

**Phase 1 — Bootstrap (today):** Single-channel payments between early adopters. Direct channels. Manual channel management. Hundreds of devices.

**Phase 2 — Factory Era:** Channel factories for device fleets. Virtual channels for customer relationships. Automated splicing for long-running channels. Thousands of devices.

**Phase 3 — Router Era:** Multi-hop routing connects isolated channel clusters. Cross-token swaps enable multi-currency payments. Router nodes earn fees and provide liquidity. Millions of devices.

**Phase 4 — Autonomous Era:** QVAC agents manage channels, rebalance liquidity, and optimise routing. Devices discover each other via the lookup network and open channels autonomously. MachinePay enforces per-unit pricing with credit gates. Billions of devices.

---

## 15. The Full Eefi Stack

The Omnia Payment Network is the financial layer of Edge DeFi (Eefi). It composes with the other Totem Edge layers to create a complete stack for autonomous device finance:

```
┌─────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                         │
│  MachinePay (credit gating) · Industrial Action (actuation) │
│  Agent Policy (QVAC seam) · Governance (DAO voting)         │
├─────────────────────────────────────────────────────────────┤
│                    OMNIA PAYMENT NETWORK                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Channels │  │  Router  │  │ Factory  │  │  Splice  │  │
│  │ (eltoo)  │  │(multi-hop)│  │ (N-of-N) │  │(resizing)│  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────────┐  │
│  │  VTXO    │  │Statechain│  │     SE Server (notary)   │  │
│  │(account) │  │ (passes) │  │                          │  │
│  └──────────┘  └──────────┘  └──────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                    TRUST LAYER                               │
│  Provider Bonds (MINIMA collateral) · Liquidity Bonds       │
│  Identity (WOTS-signed) · Manifests (self-description)      │
│  Proofs (cryptographic evidence) · ProofGraph (DAG index)   │
├─────────────────────────────────────────────────────────────┤
│                    TRANSPORT LAYER                           │
│  Hyperswarm DHT · WebSocket Relay · Self-Hosted Relay       │
│  Lookup Protocol (P2P discovery) · Stream Transport         │
├─────────────────────────────────────────────────────────────┤
│                    CRYPTOGRAPHIC LAYER                       │
│  WOTS+ Signatures · TreeKey Hierarchy · MMR Proofs          │
│  SHA3-256 Hashing · Byte-Exact Serialization                │
│  Rust/WASM Engine · Quantum Resistance                      │
└─────────────────────────────────────────────────────────────┘
```

Every layer is independently usable. Every layer is transport-agnostic. Every layer is quantum-resistant. Every layer composes with the others through clean port interfaces.

A soil sensor in Kenya uses the Cryptographic Layer to sign readings, the Transport Layer to announce itself on the DHT, the Trust Layer to prove its identity and bond, the Omnia Payment Network to receive payments, and the Application Layer to enforce credit gates and participate in governance.

The sensor is the infrastructure. The network is the bank. The devices are the economy.

---

## Appendix A: Package API Reference

### `@totemsdk/omnia` — Core Channel

| Function | Purpose |
|----------|---------|
| `createChannel(params)` | Create a new channel proposal |
| `acceptChannel(proposal)` | Accept a channel proposal |
| `activateChannel(channel)` | Activate after funding confirmation |
| `updateState(channel, delta)` | Propose a balance update |
| `attachCounterpartySignature(...)` | Attach counterparty's co-signature |
| `addHTLC(channel, params)` | Add an HTLC to the channel |
| `fulfillHTLC(channel, htlcId, preimage)` | Fulfill an HTLC with preimage |
| `timeoutHTLC(channel, htlcId)` | Time out an expired HTLC |
| `proposeSettlement(channel)` | Propose cooperative close |
| `buildDisputePayload(channel)` | Build unilateral close evidence |
| `verifyState(channel, state)` | Verify a channel state (9 invariant checks) |
| `getChannelReceipt(channel, state)` | Get a verifiable channel receipt |

### `@totemsdk/omnia-router` — Multi-Hop Routing

| Function | Purpose |
|----------|---------|
| `createChannelGraph()` | Create an in-memory routing graph |
| `addChannel(graph, edge)` | Add a channel edge to the graph |
| `findRoute(graph, from, to, amount, tokenId)` | Find lowest-fee route via Dijkstra |
| `findCrossTokenRoute(graph, from, to, amountIn, tokenIn, tokenOut)` | Find route with cross-token swap |
| `executeMultiHopPayment(ops, channels, route, request)` | Execute HTLC-chained payment |
| `executeCrossTokenPayment(...)` | Execute cross-token payment |
| `cancelPayment(ops, channels, route)` | Cancel and roll back all HTLCs |

### `@totemsdk/omnia-factory` — Channel Factories

| Function | Purpose |
|----------|---------|
| `createFactory(participants, tokenId)` | Create N-of-N factory proposal |
| `acceptFactory(factory)` | Co-sign and activate factory |
| `openVirtualChannel(factory, params)` | Open virtual channel between participants |
| `closeVirtualChannel(factory, channelId)` | Close a virtual channel |
| `reallocate(factory, from, to, amount)` | Move allocation between participants |
| `closeFactory(factory)` | Settle all virtual channels on-chain |

### `@totemsdk/omnia-splice` — Channel Resizing

| Function | Purpose |
|----------|---------|
| `quiesceChannel(channel)` | Drain HTLCs before splicing |
| `proposeSpliceIn(channel, params)` | Propose adding funds |
| `proposeSpliceOut(channel, params)` | Propose withdrawing funds |
| `acceptSplice(proposal)` | Co-sign a splice proposal |
| `finalizeSplice(proposal, signatures)` | Broadcast splice transaction |

### `@totemsdk/omnia-vtxo` — Virtual UTXOs

| Function | Purpose |
|----------|---------|
| `createPool(params)` | Create a VTXO pool |
| `mintVtxo(pool, params)` | Mint a new VTXO from pool capacity |
| `transferVtxo(vtxo, params)` | Transfer VTXO to new owner |
| `splitVtxo(vtxo, params)` | Split VTXO into multiple pieces |
| `mergeVtxos(vtxos, params)` | Merge multiple VTXOs into one |
| `refreshVtxo(vtxo, params)` | Refresh against new pool epoch |
| `markExiting(vtxo)` / `markExited(vtxo)` | Exit VTXO to on-chain |
| `verifyVtxo(vtxo)` | Verify VTXO fields + Merkle proof |
| `verifyConservation({ inputs, outputs })` | Verify balance conservation |

### `@totemsdk/statechain` — Off-Chain Ownership

| Function | Purpose |
|----------|---------|
| `createStateChain(coin, se)` | Lock UTXO into a statechain |
| `transferOwnership(chain, newOwner)` | Transfer to new owner with SE blind sig |
| `verifyStateChain(chain)` | Verify full chain of custody |
| `claimOwnership(chain)` | Cooperative on-chain claim |
| `reclaimAbandoned(chain)` | Unilateral reclaim after timelock |

### `@totemsdk/se-server` — Statechain Entity

| Function | Purpose |
|----------|---------|
| `createSeServer(config)` | Create configured SE server |
| `loadConfigFromEnv()` | Load config from environment variables |
| `getPublicKeyHex(seed)` | Derive SE public key from seed |

---

## Appendix B: KISSVM Channel Scripts

### Eltoo Channel Script

```
LET SETTLEMENT=STATE(100)
LET SEQUENCE=STATE(101)
LET PREVSEQUENCE=PREVSTATE(101)
ASSERT MULTISIG(2 pkA pkB)
IF SETTLEMENT THEN
    IF SEQUENCE EQ PREVSEQUENCE AND @COINAGE GTE 256 THEN RETURN TRUE ENDIF
ELSE
    IF SEQUENCE GT PREVSEQUENCE THEN RETURN TRUE ENDIF
ENDIF
```

### Statechain Locking Script

```
LET OWNER=STATE(0)
IF @COINAGE GTE 256 THEN
  RETURN SIGNEDBY(OWNER)
ENDIF
ASSERT MULTISIG(2 OWNER sePkd)
RETURN TRUE
```

### Factory Funding Script

```
ASSERT MULTISIG(N pk1 pk2 ... pkN)
RETURN TRUE
```

---

*The Omnia Payment Network Blue Paper. P2P payment channels that scale to billions of devices — the financial infrastructure for the machine economy.*
