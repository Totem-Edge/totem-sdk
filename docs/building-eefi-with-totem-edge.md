<!--
  SEO metadata (for standalone repo README / social sharing)
  title: Building Eefi with Totem Edge — Edge DeFi, IoT Payments & the Machine Economy on Minima
  description: Edge DeFi (Eefi) is a new category of financial infrastructure where IoT devices, sensors, and machines run their own payment channels, liquidity pools, and governance — all on the Minima blockchain, all quantum-resistant, all without cloud servers. Learn how the Totem SDK's 55+ packages compose to turn every device into a bank.
  keywords: Edge DeFi, Eefi, IoT payments, machine economy, machine-to-machine payments, M2M payments, autonomous payments, device payments, Minima blockchain, Totem SDK, Omnia payment channels, eltoo, WOTS signatures, quantum-resistant, statechains, VTXO, channel factory, MachinePay, QVAC, agent policy, recursive MAST, quadratic voting, liquid democracy, provider bonds, liquidity bonds, edge computing, industrial IoT, DePIN, decentralized physical infrastructure
  og:image: https://totem.ing/img/totem-edge-framework.png
  og:type: article
  article:tag: Edge DeFi, IoT, Minima, blockchain, payments, DePIN
-->

# Building Eefi with Totem Edge

**Edge DeFi (Eefi) is a new category of financial infrastructure where IoT devices, sensors, and machines run their own payment channels, liquidity pools, and governance — all on the Minima blockchain, all quantum-resistant, all without cloud servers. This is the definitive guide to building the machine economy with the Totem SDK.**

---

> *A solar inverter in a German field wakes up. It checks its WOTS key lease — slot 847 still reserved, good. It publishes a signed manifest to the P2P lookup network: "Solar Inverter 7, €0.12/kWh, Omnia channels accepted." A customer's wallet in Tokyo discovers it, verifies the manifest against the inverter's identity document, opens an eltoo payment channel, and begins drawing power. As each kilowatt-hour flows, the inverter meters it, triggers a channel state update, and enforces a credit gate — if the customer's prepaid balance drops below zero, the inverter shuts off the circuit. Every action produces a WOTS-signed proof anchored on-chain. The inverter's fleet operator, 300km away, votes via quadratic governance on whether to raise the per-kWh fee. A QVAC agent monitors wholesale energy prices and proposes dynamic adjustments — but the agent-policy chokepoint ensures the agent never touches the inverter's signing keys.*
>
> *There is no cloud server. No payment processor. No trusted third party. The inverter is the infrastructure.*

---

## Table of Contents

1. [What is Eefi?](#1-what-is-eefi-edge-defi-explained) — Edge DeFi explained: why the machine economy needs its own financial infrastructure
2. [The Device Declares Itself](#2-the-device-declares-itself-identity-manifests--discovery) — Identity, manifests, and P2P discovery for autonomous devices
3. [The Payment Rail: Omnia Eltoo Channels](#3-the-payment-rail-omnia-eltoo-payment-channels) — Why eltoo beats Lightning for devices, plus splicing, multi-hop routing, and channel factories
4. [Two Payment Models for Machines](#4-two-payment-models-for-machines-streaming-micropayments--prepaid-passes) — Streaming micropayments vs. statechain prepaid passes
5. [The Accounting Layer: VTXOs and Liquidity](#5-the-accounting-layer-vtxos--liquidity-bonds) — Virtual UTXOs, liquidity bonds, and the settlement bridge to L1
6. [MachinePay: Credit Gating and Auto-Shutdown](#6-machinepay-credit-gating--auto-shutdown) — Usage metering, credit enforcement, and offline operation for pay-per-use devices
7. [The Trust Layer: Provider Bonds and Reputation](#7-the-trust-layer-provider-bonds--reputation) — How devices assess counterparty trust without centralized ratings
8. [The Authority Layer: Mandates, Delegation, and Recursive MAST](#8-the-authority-layer-mandates-delegation--recursive-mast) — Cryptographic permission slips and the 7-layer policy stack
9. [The Governance Layer: Devices as DAO Members](#9-the-governance-layer-devices-as-dao-members) — Quadratic voting, liquid democracy, and machine-enforceable governance outcomes
10. [The AI Seam: Agent Policy and QVAC](#10-the-ai-seam-agent-policy--qvac) — How AI agents propose actions without ever touching signing keys
11. [The Proof Layer: Cryptographic Evidence for Everything](#11-the-proof-layer-cryptographic-evidence-for-everything) — WOTS-signed proofs, on-chain anchoring, and the proof relationship graph
12. [The Full Stack in Action](#12-the-full-stack-in-action-a-solar-farm-running-its-own-financial-infrastructure) — A day in the life of a 50-inverter solar farm running Eefi
13. [The Road Ahead](#13-the-road-ahead) — What's next for Edge DeFi and the machine economy
- [Key Terminology](#key-terminology) — Glossary of Eefi concepts
- [Packages Referenced](#packages-referenced) — All 41 Totem SDK packages with deep links

---

## 1. What is Eefi? (Edge DeFi Explained)

**Eefi = Edge DeFi.** Not "DeFi accessed from a phone." Not "IoT devices that accept crypto." Eefi is a fundamentally new category of financial system where the devices that produce and consume value *are themselves* the financial infrastructure.

Think about how money moves today. A factory sensor detects a temperature anomaly. That data flows to a cloud dashboard. A human reads it. A human opens a banking app. A human initiates a payment. A payment processor settles it days later. Five intermediaries. Five points of failure. Five parties taking a cut. Zero cryptographic proof that the sensor reading was real.

Now imagine the same scenario in Eefi. The sensor detects the anomaly. It has its own identity — a WOTS-signed `TotemIdentityDocument` proving it is Sensor 42 in Factory 7, controlled by the facility operator. It has its own manifest — an `EdgeServiceManifest` declaring it charges €0.001 per reading, payable over Omnia channels. It has its own payment channel open with the maintenance contractor. It produces a cryptographically signed proof of the reading, triggers a channel update for €0.001, and the contractor's system automatically dispatches a technician — all in under a second, all provable, all without a single centralized server.

**The device is the bank. The device is the auditor. The device is the market participant.**

This isn't science fiction. Every piece of this stack exists today in the Totem SDK — 55+ packages spanning cryptographic primitives, payment channels, identity systems, governance frameworks, proof layers, and edge computing runtimes. This article walks through how they compose to create Eefi, following two journeys: a human user who wants to pay a device for a service, and a device that wants to earn revenue autonomously.

---

## 2. The Device Declares Itself: Identity, Manifests & Discovery

Before any money can flow, the device must answer three questions: *Who am I? What do I do? How do you pay me?*

### Identity: Who controls this device?

Every device in the Totem ecosystem has a `TotemIdentityDocument` (`@totemsdk/identity`). It names a permanent root Minima address and a current controller address. The root address never changes — it's the device's cryptographic birth certificate. The controller can rotate, letting a fleet operator hand off control without changing the device's fundamental identity.

```typescript
const doc = createIdentityDocument({
  kind: 'device',
  rootAddress: 'MxDEVICE7...',      // permanent
  controllerAddress: 'MxFLEET42...', // can rotate
});
```

But identity alone isn't enough. The device needs to delegate authority. A `DelegationClaim` lets the root identity authorize a hot key to sign manifests and proofs on its behalf — without exposing the root key:

```typescript
const delegation = createDelegationClaim({
  issuer: doc.rootAddress,
  subject: doc.id,
  delegatedAddress: 'MxHOTKEY...',
  scopes: ['manifest:sign', 'proof:create', 'payment:receive'],
});
```

A `PaymentRecipientClaim` registers where the device receives money. A `ServiceEndpointClaim` announces where it can be reached (MQTT topic, Hyperswarm key, HTTPS endpoint). Together, these claims form an identity graph that any counterparty can resolve and verify:

```typescript
const { resolved } = resolveIdentityGraph({ document: doc, claims });
// resolved.status === 'active'
// resolved.paymentRecipients → [{ address: 'MxPAY...', label: 'primary' }]
// resolved.serviceEndpoints → [{ type: 'mqtt', uri: 'totem/inverter-7' }]
```

### Manifest: What does this device do and what does it charge?

The `EdgeServiceManifest` (`@totemsdk/manifest`) is the device's public self-description. It declares the device's type, its capabilities, its pricing, and — critically — how it accepts payment:

```typescript
const manifest: EdgeServiceManifest = {
  type: 'edge-service',
  serviceType: 'machine-service',
  name: 'Solar Inverter 7',
  operatorAddress: 'MxFLEET42...',
  description: '3.6kW grid-tied solar inverter, Modbus RTU',
  capabilities: ['payment:send', 'proof:create', 'transport:modbus'],
  price: '0.12',                    // MINIMA per kWh
  paymentMethods: ['omnia', 'onchain'],
  endpoints: [{ type: 'mqtt', uri: 'totem/solar-farm/inverter-7' }],
};
```

The manifest is WOTS-signed and cryptographically bound to the device's identity. A counterparty can verify both in one step:

```typescript
const binding = await bindManifestToIdentity(signedManifest, identityGraph);
// binding.valid === true
// binding.signerAddress matches the delegated hot key
// binding.resolvedStatus === 'active'
```

### Discovery: How does anyone find this device?

The device announces itself on the P2P lookup network (`@totemsdk/lookup-node` / `lookup-client` / `lookup-protocol`). The lookup node is a personal chain indexer running on Hyperswarm — no central server, no Axia dependency. The device publishes its manifest, and anyone running a lookup client can discover it:

```
Customer's lookup client:
  "Find me all machine-service devices tagged 'solar' within 50km"
  → [Inverter 7, Inverter 12, Battery Bank 3]

Customer verifies each:
  → Manifest signature valid ✓
  → Identity binding valid ✓
  → Provider bond score: 92/100 ✓
  → Price: €0.12/kWh, Omnia accepted ✓
```

**Journey checkpoint — the human user:** You open a dApp that needs to pay for solar power. The dApp uses `@totemsdk/connect` to talk to your Totem browser wallet. It queries the lookup network, finds Inverter 7, verifies its manifest and identity, and shows you: "Solar Inverter 7 — €0.12/kWh — 92% reliability score — Pay with Omnia?" You click approve. The wallet opens a channel. Power flows. You never saw a payment processor, a bank, or a cloud dashboard.

**Journey checkpoint — the device:** Inverter 7 boots up. It checks its WOTS lease — key slots 840-850 reserved. It signs its manifest with slot 840. It publishes to the lookup network. It waits. A channel open request arrives from a verified customer. The inverter's policy engine checks: is this customer's identity valid? Is the channel funded? Are we within operating hours? All checks pass. The channel opens. The inverter begins metering.

---

## 3. The Payment Rail: Omnia Eltoo Payment Channels

If manifests and identity are the *declaration* layer, Omnia is the *execution* layer. This is where money actually moves.

### Why eltoo?

Most payment channel networks (like Lightning) use a punishment model: if you try to cheat by broadcasting an old channel state, I can take all your money. This requires every participant to store revocation secrets for every previous state and watch the chain constantly for cheating attempts. For a device with limited storage and intermittent connectivity, this is a nightmare.

**Eltoo** (`@totemsdk/omnia`) eliminates punishment entirely. Every channel state carries a monotonically increasing update number. The latest state always replaces any earlier one on-chain. No revocation secrets. No watchtower anxiety. No penalty transactions. A device can go offline for a week, come back, and safely continue operating its channel.

### Channel lifecycle

A channel between a customer and Inverter 7 follows a simple lifecycle:

```
open → fund → update (repeat) → cooperativeClose
```

**Open:** The customer's wallet and the inverter exchange public keys and agree on initial balances. A 2-of-2 WOTS multisig covenant is created.

**Fund:** The customer deposits 100 MINIMA into the channel's on-chain UTXO. The channel is now `active`.

**Update:** Every time the customer consumes 1 kWh, the inverter triggers a state update: "New balance: Customer 99.88 MIN, Inverter 0.12 MIN." The customer co-signs. This happens off-chain, in milliseconds, with zero transaction fees.

**Close:** When the customer is done, they cooperatively close the channel. The final state is broadcast to Minima L1 as a single transaction. The inverter gets its 0.12 MIN per kWh. The customer gets their remaining balance back.

### Growing and shrinking: Channel splicing

What if the customer wants to buy more power than their initial deposit covers? What if the inverter operator wants to extract profits without closing the channel?

`@totemsdk/omnia-splice` lets participants add or remove funds from an active channel without the disruptive close → reopen cycle. A splice-in creates a new on-chain UTXO with the adjusted balance. A splice-out withdraws funds to an on-chain address. The channel's off-chain state continues uninterrupted.

For a solar farm running 24/7, this is critical. The channel might run for months. Splicing lets the operator extract revenue periodically without ever stopping service.

### Multi-hop: Reaching anyone, anywhere

A customer in Tokyo doesn't need a direct channel to Inverter 7 in Germany. `@totemsdk/omnia-router` builds a channel graph and finds optimal payment paths using Dijkstra/Bellman-Ford algorithms. The payment hops through intermediary nodes — each one earning a small routing fee — and arrives at the inverter atomically. If any hop fails, the entire payment rolls back.

The router also supports cross-token swaps at intermediate nodes. A customer holding Token A can pay an inverter that only accepts Token B, with the swap happening transparently at a routing node.

### Channel factories: One UTXO, many devices

A solar farm with 50 inverters doesn't need 50 on-chain UTXOs. `@totemsdk/omnia-factory` creates an N-of-N multisig factory channel: one on-chain UTXO funds the entire farm. Each inverter opens *virtual channels* with customers entirely off-chain. 50 devices, 200 active customers, 1 on-chain footprint.

When a customer wants to exit, the factory settles all affected virtual channels in a single on-chain transaction. The factory can also be spliced to add capacity as the farm grows.

### Connectivity: How devices behind NAT participate

A constrained IoT device behind a firewall can't run a full Hyperswarm DHT node. The relay system supports three modes: **native** (direct P2P over UDP, for devices that can), **hosted** (Axia-managed WebSocket relay, for browsers and restricted environments), and **self-hosted** (your own relay node, for air-gapped deployments). The device just needs a WebSocket connection.

**Journey checkpoint — the human user:** Your wallet has an open Omnia channel with Inverter 7. You're drawing 2.4kW to charge your car. Every 30 seconds, your wallet receives a channel update: "You've used 0.02 kWh. New balance: 99.76 MIN." You can see the live stream. When you unplug, the channel closes cooperatively. The final settlement appears on-chain. You received a WOTS-signed receipt for every kilowatt-hour. If you ever need to prove you paid, the proofs are anchored on Integritas.

**Journey checkpoint — the device:** Inverter 7 has 14 active channels open with 14 different customers. It's part of a 50-inverter channel factory — one on-chain UTXO backs the entire farm. Every 5 seconds, it reads the Modbus power meter, computes the delta, and triggers channel updates for each active customer. The usage meter tracks cumulative kWh per customer. The credit gate is set to `block` mode: if any customer's unpaid balance exceeds 0.50 MIN, their circuit is cut. At midnight, the operator splices out the day's revenue — 340 MIN — without closing any channels.

---

## 4. Two Payment Models for Machines: Streaming Micropayments & Prepaid Passes

Omnia channels handle streaming payments beautifully. But not every device interaction is a continuous stream. Sometimes a customer wants to buy a fixed amount of service upfront — like a 1-hour Wi-Fi pass or a 500MB bandwidth token. For this, Totem provides Statechains.

### Streaming micropayments (Omnia channels)

**Best for:** Continuous services — power, bandwidth, compute, sensor data streams.

**How it works:** Customer opens a channel with the device. Device meters usage and triggers `updateChannel` per unit consumed. Customer co-signs each update. Channel closes when service ends.

**Example:** A GPU compute node charges €0.01 per second of inference time. A customer opens a channel with 100 MIN, runs a 500-second inference job, and the channel settles at 95 MIN to the customer, 5 MIN to the GPU node. 500 channel updates. Zero on-chain transactions during the job. One settlement transaction at the end.

### Prepaid passes (Statechains)

**Best for:** Discrete, fixed-amount services — Wi-Fi sessions, event tickets, vending machine items, content licenses.

**How it works:** A service provider creates a statechain representing "1 hour of Wi-Fi access" or "500 MB of bandwidth." The statechain is an off-chain UTXO whose ownership can be transferred without an on-chain transaction. A Statechain Entity (SE) issues blind co-signatures — the SE authorizes the transfer without learning the UTXO value or the identities of sender and receiver. The customer holds the statechain and presents it to the device. The device verifies the chain of custody off-chain and grants access.

`@totemsdk/statechain` implements the Mercury protocol for off-chain UTXO ownership transfer. `@totemsdk/se-server` lets anyone run their own Statechain Entity — self-hosted, competing on uptime, fees, and latency.

**Example:** An airport Wi-Fi provider creates 1,000 statechains, each representing "1 hour of Wi-Fi access." A traveler buys one (on-chain or off-chain). They present it to the Wi-Fi hotspot. The hotspot verifies the statechain's chain of custody — it traces back to the provider's root identity — and grants access for 1 hour. No on-chain transaction. No payment processor. The statechain itself is the ticket.

### When to use which

| Scenario | Model | Why |
|----------|-------|-----|
| Charging an EV by the kWh | Omnia streaming | Continuous, variable usage |
| Buying a 1-hour Wi-Fi pass | Statechain prepaid | Fixed, discrete service unit |
| Renting GPU compute by the second | Omnia streaming | Continuous, variable duration |
| Vending machine snack | Statechain prepaid | Fixed price, one-time redemption |
| Streaming sensor data at €0.001/reading | Omnia streaming | Continuous, per-event billing |
| Event ticket with NFT proof of attendance | Statechain prepaid | Fixed access right, transferable |

**Journey checkpoint — the human user:** You're at an airport. You open a dApp that finds nearby Wi-Fi hotspots via the lookup network. You see "Airport Wi-Fi — €2/hour — Statechain pass." You buy a pass. Your wallet receives a statechain. You present it to the hotspot. You're online. The hotspot never saw your identity — the SE's blind signature kept you private. The statechain expires after 1 hour. You never entered a credit card.

**Journey checkpoint — the device:** The Wi-Fi hotspot boots up. It loads its statechain verification policy: "Accept passes from issuer MxWIFI..., minimum 1 hour validity remaining, no double-spends." A traveler presents a statechain. The hotspot verifies the chain of custody — 4 transfers, all with valid SE blind signatures, the latest owner is the traveler's address. It checks its local double-spend database — clean. It grants access for 1 hour. It records a proof: "Statechain X redeemed at timestamp T, granted 1 hour access." The proof is anchored on-chain via Integritas. The provider can audit all redemptions.

---

## 5. The Accounting Layer: VTXOs & Liquidity Bonds

Between the payment rail (Omnia) and the prepaid pass system (Statechains) sits an accounting primitive that ties them together: the Virtual UTXO.

### VTXOs: Cash-like balances inside a shared pool

A VTXO (`@totemsdk/omnia-vtxo`) is a claim on a pool of on-chain capacity, backed by a deterministic Merkle commitment tree. Think of it as a bearer note inside a shared liquidity pool. The pool operator holds the on-chain UTXO. The VTXO holder holds the Merkle proof.

VTXOs support a full lifecycle: **mint** (create a new VTXO from pool capacity), **transfer** (send to a new owner), **split** (break into smaller denominations), **merge** (combine into a larger one), **refresh** (rotate keys for security), and **exit** (claim the on-chain funds).

The critical property for devices: VTXOs are **pure functional**. Transfers don't require live signing from the sender — the recipient just needs the Merkle proof. A device that's intermittently connected can receive VTXOs while offline and verify them when it reconnects.

### Liquidity bonds: Where does the capital come from?

Channels need funding. Factories need collateral. Routers need working capital to forward payments. `@totemsdk/liquidity-bond` provides deterministic records of productive bonded liquidity: who supplied it, what lock terms apply, what risk haircuts apply, and what allocations exist (route-reserve, channel-capital, factory-capital, RFQ-inventory).

Before a device routes a payment or opens a channel, it consults the liquidity bond records: "Is there enough productive capital allocated to route-capacity to execute this payment? What's the effective amount after risk haircuts? Are there withdrawal intents that would reduce available liquidity?"

### The settlement bridge

When off-chain activity needs to hit L1, `@totemsdk/tx-builder` constructs the Minima transaction with verified multisig, `@totemsdk/txpow` mines the proof-of-work, and `@totemsdk/wots-lease` ensures no WOTS key is ever reused during signing. `@totemsdk/root-identity` provides the multi-address identity system — one seed, up to 64 blockchain addresses, all cryptographically provable — so a device can receive payments at different addresses for different services.

**Journey checkpoint — the human user:** You've been buying solar power all month. Your wallet holds 14 VTXOs representing your remaining prepaid balance across 3 different solar farms. You want to consolidate. You merge them into one VTXO. You split off 50 MIN to pay your rent. The rest stays in the pool, earning you priority access to discounted off-peak power. You never touched L1.

**Journey checkpoint — the device:** Inverter 7 holds 340 VTXOs representing its cumulative revenue for the month. Each VTXO is a claim on the farm's shared factory UTXO. The operator wants to extract 200 MIN to pay for maintenance. The inverter splits 200 MIN worth of VTXOs, exits them to an on-chain address, and the remaining 140 MIN stays in the pool as working capital for next month's channels. The liquidity bond records update: available factory capital reduced by 200 MIN, risk haircut recalculated.

---

## 6. MachinePay: Credit Gating & Auto-Shutdown

All of this — channels, statechains, VTXOs — is useless if a device can't enforce payment. A Wi-Fi hotspot that serves bytes regardless of whether the customer paid is just a charity. MachinePay (`@totemsdk/edge-mqtt`) is the enforcement layer.

### The usage meter

MachinePay tracks consumption by unit type: `message`, `byte`, `second`, `minute`, `kWh`, `reading`, `command`, or `custom`. Every unit consumed increments a counter. The meter is local to the device — no network call needed to track usage.

### The credit gate

Three enforcement modes:

- **Block:** Reject service when unpaid balance exceeds threshold. The Wi-Fi hotspot stops routing packets. The inverter cuts the circuit. The GPU node rejects inference requests.
- **Warn:** Allow service but flag the account. Useful for trusted customers with a grace period.
- **Shutdown:** Block service AND publish a shutdown notice to the MQTT topic. The customer's wallet receives: "Service suspended — unpaid balance: 2.40 MIN."

### Offline operation

Devices lose connectivity. MachinePay includes an in-memory FIFO queue with dead-letter handling. Usage events are queued during disconnection and replayed when connectivity returns. No billing events are lost. The device can operate autonomously for hours or days without a network connection.

### The end-to-end Wi-Fi hotspot

Let's walk through a complete MachinePay flow:

1. **Discovery:** A traveler's device finds "Cafe Wi-Fi" via the lookup network. Manifest verified. Identity bound. Provider bond score: 88/100. Price: €0.01/MB, Omnia accepted.

2. **Channel open:** The traveler's wallet opens an Omnia channel with 5 MIN deposited.

3. **Service begins:** The traveler connects. The hotspot's usage meter starts counting bytes.

4. **Per-MB billing:** Every 10MB consumed, the hotspot triggers a channel update: "Traveler used 10MB. New balance: Traveler 4.90 MIN, Hotspot 0.10 MIN." The traveler's wallet auto-approves (amount is below the auto-approve threshold in their agent policy).

5. **Credit gate triggers:** The traveler's balance drops to 0.20 MIN — below the 0.50 MIN warning threshold. The hotspot sends a warning: "Low balance — 20MB remaining."

6. **Auto-shutdown:** Balance hits 0. The credit gate is in `shutdown` mode. The hotspot stops routing packets. It publishes a shutdown notice. The traveler's wallet receives: "Cafe Wi-Fi suspended. Top up to reconnect."

7. **Top-up:** The traveler splices 10 MIN into the channel. Service resumes.

8. **Session end:** The traveler disconnects. The channel closes cooperatively. Final settlement: Hotspot earned 0.87 MIN for 87MB served. A WOTS-signed receipt is generated and anchored on-chain.

**Journey checkpoint — the human user:** You never saw a captive portal. You never entered a credit card. You never created an account. Your wallet discovered the hotspot, opened a channel, and paid per megabyte — all automatically, within the spending limits you configured. When your balance ran low, you got a notification. When you left, the channel closed and you received a cryptographically verifiable receipt.

**Journey checkpoint — the device:** The hotspot served 47 customers today. It opened 47 channels, processed 3,200 channel updates, enforced credit gates 12 times (8 warnings, 4 shutdowns), and earned 23.40 MIN. It never connected to a payment processor. It never queried a cloud database. It never asked permission from a central server. It just enforced the rules.

---

## 7. The Trust Layer: Provider Bonds & Reputation

In a centralized system, trust comes from the brand. You trust Stripe because Stripe is Stripe. In Eefi, there is no Stripe. Trust must be computed, not assumed.

`@totemsdk/provider-bond` gives devices a deterministic way to answer: "Should I trust this counterparty?"

### The scoring model

Every provider — a router, a liquidity pool, a statechain entity, a lookup node — has a reputation score computed from four weighted factors:

| Factor | Weight | What it measures |
|--------|--------|-----------------|
| **Identity** | 25% | Is the provider's manifest cryptographically bound to a valid, unrevoked identity? |
| **Bond** | 30% | How much MINIMA hard collateral has the provider staked? Real skin in the game. |
| **Reliability** | 30% | What's the provider's uptime? Latency? Successful vs. failed probes? |
| **Incidents** | 15% | Any downtime events? High-latency periods? Failed probes? Invalid responses? |

The score produces a recommendation: `recommended` (85+), `acceptable` (70-84), `risky` (50-69), `avoid` (below 50), `unbonded` (no collateral), or `offline` (unreachable).

### How devices use it

Before Inverter 7 routes a payment through Router Node 42, it checks:

```
Router Node 42:
  Identity: valid, unrevoked ✓
  Bond: 5,000 MINIMA staked ✓
  Reliability: 99.2% uptime, 45ms avg latency ✓
  Incidents: 1 downtime event in 90 days (resolved in 3 minutes) ✓
  Score: 91/100 → RECOMMENDED
```

Before a customer opens a channel with Inverter 7, their wallet checks:

```
Solar Inverter 7:
  Identity: valid, bound to manifest ✓
  Bond: 1,000 MINIMA staked (fleet operator's collateral) ✓
  Reliability: 99.8% uptime, 12ms avg response ✓
  Incidents: 0 in 180 days ✓
  Score: 94/100 → RECOMMENDED
```

The bond isn't just a score — it's real MINIMA that can be slashed if the provider misbehaves. A router that consistently fails to forward payments loses its bond. A statechain entity that signs invalid transfers loses its bond. The economic incentive aligns with honest behavior.

**Journey checkpoint — the human user:** You're about to open a channel with a solar farm you've never used before. Your wallet automatically checks the farm's provider bond: 94/100, 1,000 MIN staked, zero incidents. You don't need to trust the farm — the bond and the score give you verifiable assurance. If they cheat, their collateral is slashed and you're made whole.

**Journey checkpoint — the device:** Inverter 7 needs to route a payment through an intermediary node to reach a customer in another country. It queries the provider bond registry. Node A: score 91, recommended. Node B: score 45, avoid (unbonded). Node C: score 78, acceptable. It chooses Node A. The payment routes successfully. Node A earns a 0.5% fee. Inverter 7 records a positive probe for Node A, slightly increasing its reliability score. The trust graph self-reinforces.

---

## 8. The Authority Layer: Mandates, Delegation & Recursive MAST

A device that can sign any transaction, pay any amount, to any recipient, at any time, is a liability. Authority must be delegated, scoped, constrained, and verifiable.

### Mandates: Cryptographic permission slips

`@totemsdk/authority` is a pure, deterministic engine that answers one question: "Does this proposed action have verifiable authority?" It takes a mandate (a digitally signed delegation), an action (what the device wants to do), and a usage snapshot (what the device has already done), and returns a yes/no decision.

A mandate looks like this:

```typescript
const mandate = {
  grantor: 'MxFLEET_OWNER...',     // who delegated the authority
  grantee: 'MxINVERTER7...',       // who received it
  principal: 'MxINVERTER7...',     // who it applies to
  scope: 'payment:send',           // what actions are allowed
  constraints: {
    maxAmount: '100',              // per-transaction cap
    dailyLimit: '500',             // per-day cap
    allowedTokens: ['0x00'],       // only MINIMA
    allowedRecipients: ['MxMAINTENANCE...', 'MxGRID_OPERATOR...'],
  },
  usageLimit: {
    maxUses: 10000,                // lifetime transaction cap
    windowMs: 86400000,            // 24-hour rolling window
    maxPerWindow: 100,             // max transactions per window
  },
};
```

When Inverter 7 wants to send 5 MIN to the maintenance contractor, the authority engine checks:
- Is the mandate valid? (WOTS signature verified) ✓
- Does the scope match? (`payment:send` matches) ✓
- Is the amount within constraints? (5 ≤ 100) ✓
- Is the recipient allowed? (MxMAINTENANCE is in the list) ✓
- Has the daily limit been exceeded? (45/500 used today) ✓
- Has the usage limit been exceeded? (2,341/10,000 lifetime) ✓

All checks pass. The action is authorized.

### Delegation chains

Authority flows through chains. The fleet owner delegates to the site controller. The site controller delegates to the device. The device delegates to a hot key for day-to-day operations. Each link is a WOTS-signed mandate. The authority engine walks the chain and verifies every link.

### Recursive MAST: The 7-layer policy stack

`@totemsdk/recursive-mast` implements nested MAST (Merkle-ized Abstract Syntax Trees) — proof-authenticated dynamic loading of bounded executable modules. A MAST statement references a Merkle root; the transaction witness supplies a script + proof resolving to that root. The loaded script executes and may itself contain another MAST statement referencing a different root.

This enables the canonical 7-layer policy stack for any device:

```
Asset Root        → "This is a genuine SolarTech Inverter, model ST-3600"
Manufacturer      → "Manufactured by SolarTech GmbH, certified ISO 9001"
Product/Model     → "Model ST-3600, firmware v3.2.1, max output 3.6kW"
Regulatory        → "Certified by TÜV Rheinland, compliant with EU Grid Code 2024"
Owner/Fleet       → "Operated by GreenEnergy FleetCo, policy root #42"
Site              → "Installed at Solar Farm Brandenburg, Section C, Row 7"
Operator          → "Operated by Technician Müller, credential #T-8872"
Action            → "Sell power at €0.12/kWh, max 3.6kW, 06:00-22:00 only"
```

Each layer is a separate MAST subtree maintained by a different authority. The manufacturer maintains the product layer. The regulator maintains the compliance layer. The fleet owner maintains the operator layer. A device only needs the branch capsules relevant to its position in the tree — not the entire policy corpus.

When Inverter 7 executes a payment, it presents the single leaf script from its MAST tree that authorizes the specific action, along with the MMR proof that this leaf is in the policy root committed on-chain. The verifier checks the proof, not the entire tree.

### PREVSTATE: State that survives transactions

Minima's `PREVSTATE(port)` opcode reads the previous transaction's state variable, enabling stateful contracts that evolve across transactions. `recursive-mast` provides ready-to-use templates: counters ("this device has sent 47/100 allowed payments"), vesting schedules ("revenue unlocks at 100 block intervals"), timelocks ("no payments before block 500,000"), and state machines ("OFF → ON → OFF transitions only").

### Cross-domain trust

A device manufactured in Germany, certified by TÜV, operated by a Dutch fleet owner, selling power to a Japanese customer, settled in MINIMA — how does each party verify the others' authority? `recursive-mast` provides cross-domain trust bridges: one policy space can accept proofs from another. The Japanese customer's wallet verifies that the German inverter's TÜV certification is valid because the EU regulatory policy root is cross-signed by a bridge authority that the Japanese regulatory space trusts.

**Journey checkpoint — the human user:** You're buying power from a solar farm in Germany. Your wallet verifies the inverter's entire authority chain: the manufacturer certified it, TÜV approved it, the fleet owner authorized it, the site registered it, the operator is credentialed. Every link is a cryptographically verifiable MAST proof. You don't need to trust the farm — you can verify its entire authority stack.

**Journey checkpoint — the device:** Inverter 7 receives a payment request: "Send 200 MIN to MxUNKNOWN..." The authority engine checks: is MxUNKNOWN in the allowed recipients list? No. The action is rejected. The device logs the rejection and publishes a proof: "Unauthorized payment attempt rejected at block 523,441." The fleet operator is notified. The device never exceeded its mandate.

---

## 9. The Governance Layer: Devices as DAO Members

Authority answers "can this device do this action?" Governance answers "should this device be allowed to do this action in the first place?"

`@totemsdk/governance` provides on-chain governance for Minima: quadratic voting, liquid democracy, and multi-hop delegation. A fleet of devices — or more precisely, their operators — can collectively decide on protocol parameters.

### Quadratic voting

In standard one-token-one-vote systems, a large fleet operator with 10,000 MIN can dominate every vote. Quadratic voting changes the cost curve: casting N votes costs N² credits. To cast 3 votes, you spend 9 credits. To cast 10 votes, you spend 100 credits. This makes extreme positions expensive and protects minority stakeholders.

### Liquid democracy

Small operators who lack the time or expertise to evaluate every proposal can delegate their voting power to trusted experts. Delegation supports multi-hop chains (Operator A → Expert B → Researcher C), scope filtering (delegate on treasury proposals but vote directly on device additions), partial-weight delegation (delegate 70%, keep 30%), and recall at any time.

### The mandate bridge

When a governance proposal passes, it doesn't just sit in a record. `createGovernedMandate()` bridges the governance outcome to an authority mandate. A passed proposal to "raise the per-kWh fee cap from €0.15 to €0.20" produces a mandate that the authority engine accepts. All devices in the fleet begin enforcing the new cap. The governance decision becomes machine-enforceable.

### The event-sourced governance ledger

Governance is not just voting. It's an append-only event log: `policy_published`, `mandate_issued`, `mandate_revoked`, `approval_granted`, `authority_decision_recorded`, `usage_recorded`. The log can be replayed to reconstruct the entire governance state at any point in time. Periodic checkpoints anchor the state hash to Minima L1, providing a tamper-evident constitutional anchor.

**Journey checkpoint — the human user:** You own 500 MIN of governance tokens in the solar farm DAO. A proposal is live: "Increase per-kWh fee cap from €0.15 to €0.20 to account for grid connection cost increases." You cast 5 votes (costing 25 credits). The proposal passes 62%-38%. Within minutes, every inverter in the farm enforces the new cap. You didn't call a meeting. You didn't sign a contract. You voted, the DAO decided, the devices enforced.

**Journey checkpoint — the device:** Inverter 7 receives a governance event: "Proposal #42 passed — fee cap now €0.20/kWh." The device's governance module verifies the proposal outcome against the L1 checkpoint. Valid. It updates its local policy: `maxPricePerKwh: 0.20`. The next customer who connects will be charged under the new cap. The device didn't ask permission. It didn't wait for a human to push a config update. It enforced the collective decision of its stakeholders.

---

## 10. The AI Seam: Agent Policy & QVAC

So far, every action has been deterministic: the device does what its policy says. But what if the device needs to respond to changing market conditions? What if it needs to negotiate prices, rebalance channels, or detect anomalies — tasks that require intelligence, not just rule evaluation?

This is where the agent-policy seam comes in.

### The pipeline

```
QVAC proposes → agent-policy evaluates → Totem signs → Minima settles
```

**QVAC** is Tether's decentralised AI framework — an external inference engine that can observe on-chain and off-chain data, reason about it, and construct proposals. QVAC watches wholesale energy prices, network congestion, channel utilization, and customer demand patterns. It constructs an `AgentProposal`: "Raise per-kWh price to €0.18 during the 18:00-20:00 peak window."

**Agent-policy** (`@totemsdk/agent-policy`) is the chokepoint. It receives the proposal and evaluates it against developer-defined rules. The policy can return:
- `approved` — the proposal is within bounds, execute it automatically
- `rejected` — the proposal violates policy, block it
- `requires_human` — the proposal needs human review, show a prompt

**Totem signs** — if approved, the wallet builds the transaction and signs it with the device's WOTS key.

**Minima settles** — the transaction is broadcast and mined.

### The critical property

**QVAC never touches a private key.** It proposes. It observes. It reasons. But it cannot sign. The `AgentPolicy` is the gate. If the policy says no, no transaction is built. This is the fundamental separation that makes autonomous device operation safe: intelligence is external, but authority remains local.

### Composable policies

Policies chain like middleware:

```typescript
const composedPolicy = {
  async evaluate(proposal) {
    // Layer 1: Rate limiting — max 1 proposal per minute
    const rateOk = await rateLimitPolicy.evaluate(proposal);
    if (rateOk.outcome !== 'approved') return rateOk;

    // Layer 2: Amount cap — max 500 MIN per proposal
    const amountOk = await amountCapPolicy.evaluate(proposal);
    if (amountOk.outcome !== 'approved') return amountOk;

    // Layer 3: Recipient allowlist — only approved counterparties
    const recipientOk = await recipientAllowlistPolicy.evaluate(proposal);
    if (recipientOk.outcome !== 'approved') return recipientOk;

    // Layer 4: Time window — no price changes during locked periods
    const timeOk = await timeWindowPolicy.evaluate(proposal);
    return timeOk;
  },
};
```

### The autonomy spectrum

The QVAC + agent-policy architecture defines a spectrum of device autonomy:

| Level | Description | Example |
|-------|-------------|---------|
| **Fully manual** | Every action requires human approval | A technician manually approves every payment |
| **Policy-automated** | Deterministic rules auto-approve within bounds | "Auto-pay up to 10 MIN per transaction to whitelisted recipients" |
| **QVAC-augmented** | QVAC proposes based on market data, policy gates execution | QVAC suggests dynamic pricing, policy enforces caps |
| **QVAC-driven** | QVAC manages complex multi-step workflows, policy acts as safety rails | QVAC orchestrates channel rebalancing across a fleet, policy prevents over-exposure |

### MCP server: The agent tooling bridge

`@totemsdk/mcp-server` exposes SDK capabilities to LLM-powered agents via the Model Context Protocol. An AI agent running in a desktop app or cloud environment can discover available Totem SDK tools, query chain state, simulate KISSVM scripts, and construct proposals — all through a standardized protocol. The MCP server is the bridge between the AI ecosystem and the Totem device ecosystem.

**Journey checkpoint — the human user:** You've configured your wallet's agent policy: "Auto-approve payments under 5 MIN to whitelisted merchants. Require my approval for anything over 50 MIN. Reject anything to unknown addresses." A QVAC agent notices your channel balance is low and proposes a 20 MIN top-up from your on-chain wallet. The policy evaluates: amount is between 5 and 50, requires human approval. Your wallet shows: "QVAC suggests topping up your solar channel with 20 MIN. Approve?" You tap yes. The agent handled the monitoring; you handled the decision.

**Journey checkpoint — the device:** Inverter 7's QVAC agent monitors the wholesale energy market. Prices spike to €0.35/kWh during a grid shortage. The agent proposes: "Raise selling price to €0.28/kWh for the next 2 hours." The agent-policy evaluates: proposed price (0.28) is below the governance-mandated cap (0.30), the time window is within operating hours, the rate limit hasn't been exceeded. Approved. The inverter updates its manifest. New customers connecting in the next 2 hours will pay the surge price. The agent never touched a key. The policy enforced the governance cap. The device adapted to market conditions autonomously.

---

## 11. The Proof Layer: Cryptographic Evidence for Everything

Every action in Eefi produces a proof. Not a database row. Not a log line. A WOTS-signed, cryptographically verifiable, on-chain anchorable proof envelope.

### Creating proofs

`@totemsdk/proof` provides a portable proof layer. Any device can create a `SignedProof` — a WOTS-signed envelope over a subject (what happened), with evidence (supporting data), and links (related proofs, identities, manifests). The proof is self-contained: anyone with the proof can verify the signature, the subject, and the evidence without querying an external database.

```typescript
const proof = createSignedProof({
  subject: { type: 'payment', id: 'pay-8842' },
  evidence: [
    { type: 'meter-reading', value: { kwh: 2.4, timestamp: 1711404000 } },
    { type: 'channel-update', value: { channelId: 'ch-3391', newBalance: '99.76' } },
  ],
  links: [
    { type: 'identity', id: 'totem:id:device:MxINVERTER7...' },
    { type: 'manifest', id: 'totem:manifest:sha3:abc123...' },
  ],
}, seed, keyIndex);
```

### Anchoring on-chain

`@totemsdk/proof-integritas` wraps the Integritas v2 REST API, letting any device stamp a proof's hash onto the Minima blockchain. The proof exists off-chain (where it can be large, rich, and detailed). Its hash exists on-chain (where it's permanent, immutable, and publicly verifiable). Anyone can verify: "Does this off-chain proof match the on-chain commitment from block 523,441?"

### The proof graph

Over time, a device accumulates thousands of proofs — payments, meter readings, channel updates, identity claims, manifest signatures, governance votes. `@totemsdk/proofgraph` builds a local, content-addressed DAG of all these proofs and their relationships. The device can query:

- "What is the current active proof set for customer X?" (excluding revoked/superseded proofs)
- "Is there a conflict?" (two proofs claiming the same subject with different values)
- "What's the evidence trail for payment #8842?" (meter reading → channel update → settlement → receipt)
- "Has this provider's identity been revoked?" (follow the revocation claim edge)

The graph is content-deterministic: the same logical content always produces the same graph ID, regardless of when or where it was built. Two devices that independently process the same proofs will arrive at the same graph state.

### Industrial action: When finance meets physics

`@totemsdk/industrial-action` bridges the gap between "a financial event occurred" and "a physical action must happen." A payment clears → a vending machine dispenses. A channel settles → a smart lock opens. A governance vote passes → a circuit breaker trips.

Industrial actions carry guardrails: parameter ranges, context matches, time windows. The action executor verifies that the financial event is valid, the guardrails are satisfied, and the physical action is authorized — then executes. Every execution produces a verifiable receipt.

**Journey checkpoint — the human user:** You paid for 1 hour of Wi-Fi at the airport. You received a WOTS-signed receipt. Six months later, you need to prove you were at the airport for a travel reimbursement. You present the receipt. The verifier checks: signature valid, anchored on-chain at block 612,441, identity bound to Airport Wi-Fi's manifest. Proof accepted. No centralized database needed.

**Journey checkpoint — the device:** Inverter 7 has produced 14,000 proofs this month. The proofgraph indexes them all. An auditor queries: "Show me all payments from customer X to Inverter 7 in March 2026." The proofgraph returns 340 proofs, each with meter readings, channel updates, and on-chain anchors. The auditor verifies the entire chain independently. The inverter passes the audit without a human ever touching it.

---

## 12. The Full Stack in Action: A Solar Farm Running Its Own Financial Infrastructure

Let's put it all together. Here is a solar farm in Brandenburg, Germany — 50 inverters, 3.6kW each, selling power directly to customers over the Minima network. No utility in the middle. No payment processor. No cloud dashboard. Just devices, code, and cryptography.

### The cast

- **50 solar inverters** — Modbus-connected, each running `@totemsdk/edge` with MachinePay
- **1 channel factory** — `@totemsdk/omnia-factory`, one on-chain UTXO backing all 50 devices
- **1 fleet operator** — GreenEnergy FleetCo, holding the root identity and governance tokens
- **1 QVAC agent** — monitoring wholesale energy markets, proposing dynamic pricing
- **1 statechain entity** — self-hosted `@totemsdk/se-server`, issuing prepaid power passes
- **200+ customers** — wallets around the world, buying power over Omnia channels

### The setup

**Step 1: Identity.** Each inverter gets a `TotemIdentityDocument`. The fleet operator's root identity delegates `manifest:sign`, `proof:create`, and `payment:receive` to each inverter's hot key.

**Step 2: Manifest.** Each inverter publishes an `EdgeServiceManifest`: "Solar Inverter N, €0.12/kWh, Omnia accepted, Modbus RTU at /dev/ttyUSB0."

**Step 3: Authority.** The fleet operator issues mandates: "Inverter N may send payments up to 100 MIN per transaction, 500 MIN per day, to whitelisted maintenance and grid operator addresses only."

**Step 4: Governance.** The fleet's stakeholders hold governance tokens. Quadratic voting protects minority operators. A passed proposal sets the fee cap at €0.30/kWh.

**Step 5: Bond.** The fleet operator stakes 50,000 MIN as a provider bond. Score: 94/100. Recommended.

**Step 6: Discovery.** All 50 inverters announce on the lookup network. Customers worldwide can discover them.

**Step 7: Factory.** The 50 inverters join a channel factory. One on-chain UTXO. Virtual channels per customer. Zero on-chain transactions for day-to-day operation.

### A day in the life

**06:00 — Sunrise.** The inverters wake up. They check WOTS leases — all keys reserved. They verify their manifests are still valid. They confirm the factory UTXO is confirmed on-chain. They begin metering.

**08:00 — Morning demand.** 30 customers have active channels. The factory is handling 30 virtual channels. Each inverter is processing 2-5 channel updates per minute as customers draw power. The usage meters are ticking: kWh consumed, MIN owed.

**12:00 — Peak solar.** All 50 inverters are at maximum output. 120 active channels. The QVAC agent notices grid frequency dropping — excess supply. It proposes: "Lower price to €0.08/kWh for 2 hours to incentivize consumption." The agent-policy evaluates: proposed price (0.08) is above the minimum (0.05), within operating hours, rate limit not exceeded. Approved. All 50 inverters update their manifests. New customers see the discounted rate.

**14:00 — Credit gate triggers.** Customer #47's channel balance drops to 0.30 MIN — below the 0.50 MIN warning threshold. The inverter sends a warning. Customer #47 splices in 50 MIN. Service continues uninterrupted.

**16:00 — Governance vote.** A proposal is live: "Increase maintenance budget from 500 MIN/month to 750 MIN/month." Operators vote. Quadratic voting ensures the two largest operators (who together hold 60% of tokens) can't unilaterally pass it. The proposal passes 58%-42%. The mandate bridge produces a new authority mandate. All inverters update their allowed recipient lists to include the new maintenance contractor.

**18:00 — Evening peak.** Grid demand spikes. The QVAC agent proposes: "Raise price to €0.25/kWh for the 18:00-20:00 window." The agent-policy checks: 0.25 is below the governance cap of 0.30. Approved. Prices surge. Customers who configured their wallets to avoid surge pricing automatically reduce consumption or switch to battery storage.

**20:00 — Prepaid pass redemption.** A customer presents a statechain: "100 kWh prepaid power pass, issued by GreenEnergy FleetCo." Inverter 12 verifies the statechain's chain of custody — 3 transfers, all with valid SE blind signatures, current owner matches the customer's address. It checks its local double-spend database — clean. It grants 100 kWh of power at the contracted rate. No channel needed. No on-chain transaction.

**22:00 — Shutdown.** Operating hours end. The inverters stop accepting new channels. Existing channels drain. The last customer disconnects at 22:14.

**23:00 — Settlement.** The operator splices out the day's revenue: 1,840 MIN extracted from the factory UTXO without closing any channels. The liquidity bond records update. The proofgraph indexes the day's 28,000 proofs. A checkpoint anchors the governance state hash to L1.

**00:00 — Audit.** An automated auditor queries the proofgraph: "Show me all payments, meter readings, and channel updates for March 15, 2026." 28,000 proofs returned. Every single one verifiable. Every single one anchored on-chain. The auditor signs off. The farm sleeps.

### No cloud. No processor. No intermediary.

At no point in this day did any inverter connect to a payment processor. At no point did any customer enter a credit card. At no point did a human manually approve a routine payment. At no point did a centralized server coordinate the fleet. The devices ran the infrastructure. The devices were the infrastructure.

---

## 13. The Road Ahead

Eefi is not a finished product. It's a direction. The Totem SDK provides the primitives. The composition is up to builders. Here's what's on the horizon:

**Near term:**
- Real WOTS operator signing for VTXO pools (currently using mock signatures)
- Pool-wide epoch roots for VTXO commitment trees
- Audited KISSVM exit scripts for VTXO redemption
- Watchtower monitoring for channel factory safety
- Production-grade SE server with key rotation and Postgres persistence

**Medium term:**
- QVAC agent integration for dynamic pricing, channel rebalancing, and fleet orchestration
- Cross-domain trust bridges between regulatory jurisdictions
- Mobile SDK for Pear/Bare — devices that run on Android without Node.js
- Hardware security module (HSM) integration for WOTS key storage on physical devices

**Long term:**
- Fully autonomous device fleets that self-organize into factories, negotiate prices via QVAC agents, and settle disputes via on-chain governance
- Eefi as the default financial layer for the industrial Internet of Things — every sensor, every actuator, every machine a market participant
- A world where the edge *is* the infrastructure, and centralization is the exception, not the rule

---

## Key Terminology

| Term | Definition |
|------|-----------|
| **Eefi** | Edge DeFi — financial infrastructure run by devices at the edge, not by cloud servers |
| **MachinePay** | The pay-per-use micropayment pattern where devices meter usage and enforce credit gates |
| **QVAC** | Tether's decentralised AI framework — the external inference engine that plugs into the agent-policy seam to propose actions without ever holding keys |
| **Agent Policy** | The chokepoint between AI agents and wallets — a developer-supplied evaluator that approves, rejects, or escalates every proposed action |
| **VTXO** | Virtual UTXO — a cash-like off-chain balance claim backed by a Merkle commitment tree |
| **Statechain** | Off-chain UTXO ownership transfer with blind SE co-signatures — the "prepaid pass" primitive |
| **Channel Factory** | N-of-N group channel where virtual channels between participants open/close entirely off-chain |
| **Eltoo** | A payment channel protocol using sequential update numbers instead of punishment — no revocation secrets needed |
| **Policy Tree** | 7-layer recursive MAST hierarchy: Asset → Manufacturer → Product → Regulatory → Owner → Site → Operator → Action |
| **Mandate** | A cryptographically signed delegation of authority with scope, constraints, and usage limits |
| **Provider Bond** | MINIMA hard collateral + reliability scoring — the trust primitive for autonomous device-to-device interactions |
| **Manifest** | A WOTS-signed self-description declaring what a device is, what it charges, and how to pay it |
| **Identity Document** | A cryptographically verifiable declaration of who controls a device, with delegation claims for payment receiving and authority |
| **PREVSTATE** | Minima opcode enabling stateful contracts that evolve across transactions — counters, vesting, state machines |
| **MAST** | Merkle-ized Abstract Syntax Tree — proof-authenticated dynamic loading of bounded executable modules |
| **WOTS** | Winternitz One-Time Signatures — quantum-resistant signature scheme used throughout the Totem SDK |

---

## Packages Referenced

> All packages live in the [Totem SDK monorepo](https://github.com/Totem-Edge/totem-sdk) under [`packages/`](https://github.com/Totem-Edge/totem-sdk/tree/main/packages). Each package has its own README with full API documentation.

| Package | Source | Role in Eefi |
|---------|--------|-------------|
| `@totemsdk/edge` | [`packages/edge`](https://github.com/Totem-Edge/totem-sdk/tree/main/packages/edge) | Device runtime — port injection, capability model, device identity |
| `@totemsdk/edge-mqtt` | [`packages/edge-mqtt`](https://github.com/Totem-Edge/totem-sdk/tree/main/packages/edge-mqtt) | MachinePay — usage metering, credit gating, offline queuing |
| `@totemsdk/edge-adapters` | [`packages/edge-adapters`](https://github.com/Totem-Edge/totem-sdk/tree/main/packages/edge-adapters) | Bridges SDK packages to Edge port interfaces |
| `@totemsdk/manifest` | [`packages/manifest`](https://github.com/Totem-Edge/totem-sdk/tree/main/packages/manifest) | Signed self-description for every device and service |
| `@totemsdk/identity` | [`packages/identity`](https://github.com/Totem-Edge/totem-sdk/tree/main/packages/identity) | Cryptographic identity documents, delegation claims, manifest binding |
| `@totemsdk/omnia` | [`packages/omnia`](https://github.com/Totem-Edge/totem-sdk/tree/main/packages/omnia) | Eltoo payment channels — the core payment rail |
| `@totemsdk/omnia-router` | [`packages/omnia-router`](https://github.com/Totem-Edge/totem-sdk/tree/main/packages/omnia-router) | Multi-hop payment routing with cross-token swaps |
| `@totemsdk/omnia-splice` | [`packages/omnia-splice`](https://github.com/Totem-Edge/totem-sdk/tree/main/packages/omnia-splice) | Channel resizing without closing |
| `@totemsdk/omnia-factory` | [`packages/omnia-factory`](https://github.com/Totem-Edge/totem-sdk/tree/main/packages/omnia-factory) | N-of-N group channels with virtual channel support |
| `@totemsdk/omnia-vtxo` | [`packages/omnia-vtxo`](https://github.com/Totem-Edge/totem-sdk/tree/main/packages/omnia-vtxo) | Virtual UTXOs — off-chain balance claims with Merkle proofs |
| `@totemsdk/statechain` | [`packages/statechain`](https://github.com/Totem-Edge/totem-sdk/tree/main/packages/statechain) | Off-chain UTXO ownership transfer with blind SE co-signatures |
| `@totemsdk/se-server` | [`packages/se-server`](https://github.com/Totem-Edge/totem-sdk/tree/main/packages/se-server) | Self-hostable Statechain Entity server |
| `@totemsdk/authority` | [`packages/authority`](https://github.com/Totem-Edge/totem-sdk/tree/main/packages/authority) | Deterministic authority engine — mandate verification, scope matching |
| `@totemsdk/governance` | [`packages/governance`](https://github.com/Totem-Edge/totem-sdk/tree/main/packages/governance) | On-chain governance — quadratic voting, liquid democracy |
| `@totemsdk/recursive-mast` | [`packages/recursive-mast`](https://github.com/Totem-Edge/totem-sdk/tree/main/packages/recursive-mast) | Nested MAST policy trees, PREVSTATE state machines, cross-domain trust |
| `@totemsdk/agent-policy` | [`packages/agent-policy`](https://github.com/Totem-Edge/totem-sdk/tree/main/packages/agent-policy) | AI-to-wallet interface — QVAC proposal evaluation and gating |
| `@totemsdk/mcp-server` | [`packages/mcp-server`](https://github.com/Totem-Edge/totem-sdk/tree/main/packages/mcp-server) | MCP server exposing SDK capabilities to LLM-powered agents |
| `@totemsdk/provider-bond` | [`packages/provider-bond`](https://github.com/Totem-Edge/totem-sdk/tree/main/packages/provider-bond) | Provider trust scoring with MINIMA hard collateral |
| `@totemsdk/liquidity-bond` | [`packages/liquidity-bond`](https://github.com/Totem-Edge/totem-sdk/tree/main/packages/liquidity-bond) | Productive bonded liquidity records and risk assessment |
| `@totemsdk/proof` | [`packages/proof`](https://github.com/Totem-Edge/totem-sdk/tree/main/packages/proof) | WOTS-signed proof envelopes for every action |
| `@totemsdk/proof-integritas` | [`packages/proof-integritas`](https://github.com/Totem-Edge/totem-sdk/tree/main/packages/proof-integritas) | On-chain proof anchoring via Integritas v2 |
| `@totemsdk/proofgraph` | [`packages/proofgraph`](https://github.com/Totem-Edge/totem-sdk/tree/main/packages/proofgraph) | Content-addressed DAG of proofs, identities, and relationships |
| `@totemsdk/industrial-action` | [`packages/industrial-action`](https://github.com/Totem-Edge/totem-sdk/tree/main/packages/industrial-action) | Bridge between financial events and physical actuation |
| `@totemsdk/connect` | [`packages/connect`](https://github.com/Totem-Edge/totem-sdk/tree/main/packages/connect) | dApp gateway — human interface to the Totem wallet extension |
| `@totemsdk/lookup-node` | [`packages/lookup-node`](https://github.com/Totem-Edge/totem-sdk/tree/main/packages/lookup-node) | Personal P2P chain indexer and service discovery |
| `@totemsdk/lookup-client` | [`packages/lookup-client`](https://github.com/Totem-Edge/totem-sdk/tree/main/packages/lookup-client) | Client for querying lookup nodes |
| `@totemsdk/lookup-protocol` | [`packages/lookup-protocol`](https://github.com/Totem-Edge/totem-sdk/tree/main/packages/lookup-protocol) | Binary wire protocol for P2P lookup communication |
| `@totemsdk/chain-provider` | [`packages/chain-provider`](https://github.com/Totem-Edge/totem-sdk/tree/main/packages/chain-provider) | Unified abstraction over chain data sources |
| `@totemsdk/realtime` | [`packages/realtime`](https://github.com/Totem-Edge/totem-sdk/tree/main/packages/realtime) | Live balance streaming for instant payment confirmation |
| `@totemsdk/tx-builder` | [`packages/tx-builder`](https://github.com/Totem-Edge/totem-sdk/tree/main/packages/tx-builder) | Minima transaction construction with verified multisig |
| `@totemsdk/txpow` | [`packages/txpow`](https://github.com/Totem-Edge/totem-sdk/tree/main/packages/txpow) | Transaction proof-of-work mining |
| `@totemsdk/wots-lease` | [`packages/wots-lease`](https://github.com/Totem-Edge/totem-sdk/tree/main/packages/wots-lease) | Atomic WOTS key reservation and crash recovery |
| `@totemsdk/root-identity` | [`packages/root-identity`](https://github.com/Totem-Edge/totem-sdk/tree/main/packages/root-identity) | Multi-address identity from a single seed |
| `@totemsdk/core` | [`packages/core`](https://github.com/Totem-Edge/totem-sdk/tree/main/packages/core) | Cryptographic primitives — WOTS, TreeKey, BIP39, MMR |
| `@totemsdk/core-wasm` | [`packages/core-wasm`](https://github.com/Totem-Edge/totem-sdk/tree/main/packages/core-wasm) | Rust/WASM cryptographic engine |
| `@totemsdk/kissvm` | [`packages/kissvm`](https://github.com/Totem-Edge/totem-sdk/tree/main/packages/kissvm) | KISSVM smart contract evaluator |
| `@totemsdk/pear` | [`packages/pear`](https://github.com/Totem-Edge/totem-sdk/tree/main/packages/pear) | Pear/Bare runtime for zero-server device operation |
| `@totemsdk/server` | [`packages/server`](https://github.com/Totem-Edge/totem-sdk/tree/main/packages/server) | Server-side utilities — Axia API client |
| `@totemsdk/stream-transport` | [`packages/stream-transport`](https://github.com/Totem-Edge/totem-sdk/tree/main/packages/stream-transport) | Bidirectional byte-stream adapters |
| `@totemsdk/pubsub-transport` | [`packages/pubsub-transport`](https://github.com/Totem-Edge/totem-sdk/tree/main/packages/pubsub-transport) | Publish-subscribe transport abstractions |
| `@totemsdk/wallet-adapter` | [`packages/wallet-adapter`](https://github.com/Totem-Edge/totem-sdk/tree/main/packages/wallet-adapter) | Wallet adapter interfaces for multi-provider chain access |

---

*Built by the Totem SDK Contributors. The edge is the infrastructure.*
