# Totem Tokenomics — Gold Paper

**A two-asset model for the Totem Edge economy: $MINIMA as the sovereign collateral backbone, $TOTEM as the service-revenue token capturing value from the machine economy.**

**Version:** 1.0
**Date:** 2026-07-27
**Status:** Research — forward-looking analysis grounded in existing protocol mechanisms

---

## Table of Contents

1. [The Two-Asset Thesis](#1-the-two-asset-thesis)
2. [MINIMA: The Collateral Backbone](#2-minima-the-collateral-backbone)
3. [TOTEM: The Service Revenue Token](#3-totem-the-service-revenue-token)
4. [Economic Flows](#4-economic-flows)
5. [Value Accrual Mechanisms](#5-value-accrual-mechanisms)
6. [Governance and Treasury](#6-governance-and-treasury)
7. [The Machine Economy: Revenue Projections](#7-the-machine-economy-revenue-projections)
8. [Risk Analysis](#8-risk-analysis)
9. [Roadmap](#9-roadmap)

---

## 1. The Two-Asset Thesis

Most blockchain ecosystems suffer from a single-asset problem: the native token must simultaneously serve as the base unit for minting coloured assets, collateral, governance weight, and speculative vehicle. These functions conflict. A token optimized for low-volatility collateral is poorly suited for governance. A token optimized for staking yield is poorly suited as a minting base.

Totem Edge proposes a **two-asset model** where each asset is optimized for its economic function:

| Asset | Function | Properties |
|-------|----------|------------|
| **$MINIMA** | Sovereign collateral backbone | Scarce, secure, quantum-resistant base layer asset. Used for provider bonds, liquidity bonds, channel funding, and dispute resolution. |
| **$TOTEM** | Service revenue token | Derives value from real economic activity — routing fees, SE operation fees, MachinePay revenue, liquidity pool fees. Staked to participate in service provision. |

The two assets are complementary, not competitive. MINIMA provides the trust layer. TOTEM captures the value created on top of it.

### 1.1 Why Two Assets?

**MINIMA cannot efficiently capture service revenue.** MINIMA is the base asset of the Minima chain. It serves two distinct protocol functions: as the fractional base unit required for native tokenisation via Colour Coins (creating custom assets on the network), and as the asset burned in "The Burn" — a transaction prioritisation mechanism that permanently removes MINIMA from the total supply when blocks fill up, in return for priority inclusion. Beyond these protocol-level functions, MINIMA has limited utility. Provider Bonds create an entirely new use case: staking MINIMA as hard collateral for infrastructure providers. This gives MINIMA a structural demand driver beyond its protocol-level functions, without conflating the base asset's value capture with application-layer economics.

**A service token needs different properties than a base-layer asset.** Service revenue is recurring, predictable, and tied to real economic activity (bytes routed, channels opened, signatures issued). A token designed to capture this revenue should be stakeable, slashable, and governable — properties that are better served by a dedicated token with its own economic model.

### 1.2 The Relationship

```
┌─────────────────────────────────────────────────────────────┐
│                      $TOTEM                                  │
│  Service Revenue Token                                       │
│  ┌─────────┐  ┌─────────┐  ┌──────────┐  ┌─────────────┐  │
│  │ Routing │  │ SE Fees │  │MachinePay│  │Liquidity Pool│  │
│  │  Fees   │  │         │  │ Revenue  │  │    Fees     │  │
│  └────┬────┘  └────┬────┘  └────┬─────┘  └──────┬──────┘  │
│       │            │           │                │          │
│       └────────────┴───────────┴────────────────┘          │
│                          │                                   │
│                    Staking & Fee Distribution                │
│                          │                                   │
├──────────────────────────┼───────────────────────────────────┤
│                          │                                   │
│                      $MINIMA                                 │
│  Sovereign Collateral Backbone                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Provider │  │Liquidity │  │ Channel  │  │ Dispute  │   │
│  │  Bonds   │  │  Bonds   │  │ Funding  │  │  Bonds   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                             │
│  All hard collateral, all channel funding, all on-chain     │
│  settlement denominated in MINIMA.                           │
└─────────────────────────────────────────────────────────────┘
```

MINIMA is the foundation. TOTEM is the engine that runs on top of it. MINIMA secures the value. TOTEM distributes it.

---

## 2. MINIMA: The Collateral Backbone

MINIMA serves as the **sovereign collateral asset** for the entire Totem Edge economy. Every trust relationship, every bonded commitment, every dispute resolution mechanism ultimately settles in MINIMA. This is not a design choice — it is a security requirement. The base layer asset of the Minima blockchain is the only asset that can provide cryptographically native, quantum-resistant finality.

### 2.1 Provider Bonds

Every infrastructure provider in the Totem Edge network — router nodes, SE servers, lookup nodes, liquidity pool operators — must stake MINIMA as hard collateral to be considered trustworthy.

**Current mechanism (implemented in `@totemsdk/provider-bond`):**

| Parameter | Value |
|-----------|-------|
| Collateral asset | MINIMA (required for hard-collateral policy) |
| Bond scoring weight | 30% of total provider score |
| Score tiers | recommended (80+), acceptable (60+), risky (40+), avoid (20+), unbonded |
| Slashing trigger | Challenge upheld by governance adjudicator |
| Challenger reward | Configurable `challengerRewardBps` from slashed bond |
| Treasury destination | Configurable `treasuryPk` for remainder of slashed funds |
| Unbonding period | Configurable `unbondingDurationBlocks` with linear vesting |

**Economic implication:** As the Totem Edge network grows, the demand for MINIMA as provider collateral grows proportionally. Every new router node, every new SE server, every new liquidity pool operator must acquire and lock MINIMA to participate. This creates a structural demand floor for MINIMA that scales with network adoption.

**Projected collateral demand (illustrative):**

| Network Size | Router Nodes | SE Servers | Pool Operators | Total MINIMA Locked |
|-------------|-------------|------------|----------------|-------------------|
| Early (100 nodes) | 50 | 20 | 30 | 100,000 MIN |
| Growth (1,000 nodes) | 500 | 200 | 300 | 1,000,000 MIN |
| Mature (10,000 nodes) | 5,000 | 2,000 | 3,000 | 10,000,000 MIN |
| Global (100,000 nodes) | 50,000 | 20,000 | 30,000 | 100,000,000 MIN |

*Assumes 1,000 MIN minimum bond per node. Actual bond amounts would be market-determined.*

#### Provider Bond Entity Types

Any infrastructure provider in the Totem Edge network can stake MINIMA as hard collateral. The bond proves trustworthiness; misbehaviour results in slashing.

| Provider Type | What They Stake For | Risk If They Misbehave |
|--------------|-------------------|----------------------|
| Omnia Router Node | Prove reliability for forwarding payments | Bond slashed if they fail to forward or steal funds |
| Statechain Entity Server | Prove they won't sign invalid transfers | Bond slashed if they double-sign or forge |
| Lookup Node Operator | Prove chain data is accurate and available | Bond slashed for serving falsified chain state |
| Liquidity Pool Operator | Prove they won't exit-scam with LP funds | Bond slashed if pool capacity is misreported |
| Channel Factory Operator | Prove N-of-N covenant enforcement | Bond slashed for unauthorised factory closure |
| VTXO Pool Operator | Prove Merkle commitment tree integrity | Bond slashed for minting unbacked VTXOs |
| DHT Relay Operator | Prove relay uptime and message integrity | Bond slashed for censorship or data tampering |
| MachinePay Fleet Operator | Prove device readings are genuine | Bond slashed for falsified meter data |
| Proof Indexer / Verifier | Prove proof verification accuracy | Bond slashed for validating fraudulent proofs |
| Cross-token Swap Intermediary | Prove fair exchange rates and atomic execution | Bond slashed for rate manipulation |
| KISSVM Script Auditor | Prove audit reports are accurate | Bond slashed for certifying malicious scripts |
| Identity Verification Service | Prove identity resolution accuracy | Bond slashed for verifying revoked identities |
| Oracle / Data Feed Provider | Prove off-chain data accuracy | Bond slashed for feeding manipulated prices |
| Industrial Action Validator | Prove guardrail enforcement | Bond slashed for approving unsafe actions |
| Governance Adjudicator | Prove fair dispute resolution | Bond slashed for biased rulings |

### 2.2 Liquidity Bonds

Payment channels, channel factories, and VTXO pools require productive liquidity. Liquidity providers commit MINIMA to pools and earn fee shares from the economic activity those pools enable.

**Current mechanism (implemented in `@totemsdk/liquidity-bond`):**

| Parameter | Value |
|-----------|-------|
| Default collateral asset | MINIMA |
| Default risk haircut | 20% (2,000 bps) |
| Max pool allocation | 80% of total capacity |
| Fee models | none, record-only, pro-rata, fixed-bps, external |
| Lock types | none, fixed-duration, until-block, until-epoch, manual-release |
| Early withdrawal penalty | Configurable `earlyWithdrawalPenaltyBps` |

**Economic implication:** Liquidity providers lock MINIMA to earn fee revenue. The more economic activity flows through Omnia channels, the more liquidity is demanded, the more MINIMA is locked. This creates a positive feedback loop: network usage → liquidity demand → MINIMA lockup → reduced circulating supply → increased scarcity.

### 2.3 Channel Funding

Every Omnia payment channel is funded with MINIMA. Every channel factory is backed by a MINIMA UTXO. Every VTXO pool is denominated in MINIMA. The channel network itself is a MINIMA sink.

**Current mechanism:**

| Component | MINIMA Requirement |
|-----------|-------------------|
| Direct channel | `localAmount` + `remoteAmount` locked in 2-of-2 multisig |
| Channel factory | Single on-chain UTXO backing N participants |
| VTXO pool | `totalCapacity` locked by pool operator |
| Statechain | UTXO locked with SE co-signature |
| MachinePay prepaid | Customer deposits MINIMA into channel |

**Economic implication:** Every active payment relationship locks MINIMA. A network with 10,000 active channels at an average of 100 MIN per channel locks 1,000,000 MIN. As channels become the default payment rail for machine-to-machine commerce, the locked MINIMA supply grows with transaction volume.

### 2.4 Dispute Resolution

The KISSVM `provider-bond` template defines a challenge mechanism where disputes are resolved with MINIMA at stake:

1. **Challenger posts dispute bond** in MINIMA
2. **Governance adjudicator** rules within `adjudicationBlocks`
3. **If upheld:** Provider's bond is slashed — challenger receives reward, remainder goes to treasury
4. **If dismissed:** Dispute bond returned to challenger

This creates a **Schelling-point game** where honest behavior is economically rational. Challengers have skin in the game. Providers have skin in the game. The adjudicator's reputation is at stake. MINIMA is the settlement asset for all disputes.

### 2.5 MINIMA Value Accrual Summary

| Driver | Mechanism | Scaling Factor |
|--------|-----------|---------------|
| Provider bonds | MINIMA locked per infrastructure node | Linear with node count |
| Liquidity bonds | MINIMA locked per liquidity pool | Linear with pool TVL |
| Channel funding | MINIMA locked per active channel | Linear with channel count × avg balance |
| Dispute bonds | MINIMA at stake per challenge | Linear with dispute frequency |
| On-chain settlement | MINIMA permanently removed from supply via "The Burn" (block priority) | Linear with network usage |

**The MINIMA thesis:** As Totem Edge adoption grows, structural demand for MINIMA as collateral, liquidity, and settlement grows proportionally. This is not speculative demand — it is operational demand. Every router, every pool, every channel, every dispute requires MINIMA to function.

---

## 3. TOTEM: The Service Revenue Token

While MINIMA provides the trust layer, TOTEM captures the value created by the services that run on top of it. TOTEM is a **service revenue token** — its value derives from real economic activity: routing fees, SE operation fees, MachinePay revenue, and liquidity pool fees.

### 3.1 Design Principles

1. **Value from revenue, not speculation.** TOTEM's value is backed by actual fee revenue generated by network services. No inflationary emissions. No artificial yield.
2. **Stake to earn.** Service providers stake TOTEM to participate in fee-generating activities. Staking aligns incentives: providers who stake more earn more fee share.
3. **Slashable for misbehavior.** TOTEM stakes can be slashed for provable misbehavior (failed routing, invalid SE signatures, downtime). This creates economic security for service consumers.
4. **Governable by stakeholders.** TOTEM holders govern protocol parameters: fee floors, slashing conditions, treasury allocation, and service provider registration requirements.
5. **Composable with MINIMA.** TOTEM does not replace MINIMA as collateral. It complements it. MINIMA secures the base layer. TOTEM governs and captures value from the service layer.

### 3.2 Service Revenue Streams

TOTEM captures value from five primary revenue streams, all of which exist in the protocol today (though fee distribution is currently accounting-only in v0.1):

#### 3.2.1 Omnia Routing Fees

Every multi-hop payment through the Omnia network generates routing fees. Router nodes earn a per-hop fee on every forwarded payment.

**Current mechanism (implemented in `@totemsdk/omnia-router`):**

| Parameter | Value |
|-----------|-------|
| Fee model | Per-edge fee rate (bigint per SCALE units) |
| Default test rate | 0.1% per hop |
| Base fee minimum | 1 satoshi (configurable) |
| Max hops | 8 (configurable) |
| Pathfinding | Dijkstra — lowest total fee, then fewest hops |

**Revenue potential:** A router node forwarding 1,000 MIN per day at 0.1% per hop with an average of 3 hops earns 3 MIN per day in routing fees. At network scale (10,000 active channels, 100,000 MIN daily volume), total routing fees could reach 300 MIN per day across the network.

#### 3.2.2 Statechain Entity Fees

SE servers earn fees on every statechain operation: create, blind-sign, and claim.

**Current mechanism (implemented in `@totemsdk/se-server`):**

| Parameter | Value |
|-----------|-------|
| Fee model | `feeBasisPoints` per operation |
| Example rate | 10 bps (0.1%) |
| Registry | Operators announce fees; wallets choose based on fee + uptime |
| Billing hook | `onSign` callback fires on every signing event |

**Revenue potential:** An SE server processing 1,000 statechain operations per day at an average value of 50 MIN per operation and 10 bps earns 5 MIN per day. Statechain passes for Wi-Fi access, event tickets, and content licenses could generate millions of operations daily at global scale.

#### 3.2.3 MachinePay Service Revenue

Devices earn revenue by providing pay-per-use services: Wi-Fi, compute, energy, bandwidth, sensor data.

**Current mechanism (implemented in `@totemsdk/edge-mqtt`):**

| Parameter | Value |
|-----------|-------|
| Pricing model | Per-unit floor price (e.g., 50 satoshis per MB) |
| Payment rail | Omnia channels (streaming micropayments) |
| Credit enforcement | Block/warn/shutdown modes |
| Usage units | message, byte, second, minute, kWh, reading, command, custom |

**Revenue potential:** A single Wi-Fi hotspot serving 100 customers per day at 50 sat/MB with average usage of 100 MB earns 5,000 satoshis (0.00005 MIN) per day. At global scale (1 million hotspots), daily revenue reaches 50 MIN. A solar farm with 50 inverters selling power at €0.12/kWh could generate 340 MIN per day (as demonstrated in the Eefi article's end-to-end walkthrough).

#### 3.2.4 Liquidity Pool Fees

Liquidity providers earn fee shares from the economic activity their pools enable.

**Current mechanism (implemented in `@totemsdk/liquidity-bond`):**

| Parameter | Value |
|-----------|-------|
| Fee models | pro-rata, fixed-bps, external |
| Operator/LP split | Configurable `operatorFeeBps` and `lpFeeBps` |
| Fee sources | route-fee, rfq-spread, merchant-fee, manual-adjustment |

**Revenue potential:** A liquidity pool with 100,000 MIN TVL generating 5% annualized fee revenue produces 5,000 MIN per year in fees. Split 20/80 between operator and LPs, the operator earns 1,000 MIN and LPs earn 4,000 MIN.

#### 3.2.5 Cross-Token Swap Spreads

Intermediary nodes earn swap spreads by providing cross-token liquidity between Omnia channels.

**Current mechanism (implemented in `@totemsdk/omnia-router`):**

| Parameter | Value |
|-----------|-------|
| Rate model | Market-determined via announced rates |
| Max exposure | Configurable `maxAmountIn` per swap |
| Fee inclusion | Inbound + outbound channel fees included in total |

### 3.3 TOTEM Staking Model

Service providers stake TOTEM to participate in fee-generating activities. The stake serves three functions:

1. **Registration requirement.** To register as a service provider, a minimum TOTEM stake is required.
2. **Fee share multiplier.** A provider's share of network fees is proportional to their TOTEM stake relative to the total staked. Stake more, earn more.
3. **Slashing collateral.** TOTEM stakes can be slashed for provable misbehavior, creating economic security for service consumers.

#### TOTEM Staking by Service Provider Type

| Service Provider | Revenue Source | What TOTEM Stake Determines |
|-----------------|---------------|---------------------------|
| Router Node Operator | Per-hop routing fees (0.1% per hop) | Fee share multiplier; higher stake = higher share of network routing fees |
| SE Server Operator | Per-operation statechain fees (configurable bps) | Fee share multiplier; higher stake = more fee allocation |
| Liquidity Provider | LP fee share from pool revenue (pro-rata) | Minimum stake to register as LP; higher stake = access to larger pools |
| Pool Operator | Operator fee share (configurable operatorFeeBps) | Registration requirement; higher stake = higher operator fee cap |
| MachinePay Device Operator | Per-unit service fees (per-MB, per-kWh, per-second) | Registration requirement; higher stake = higher auto-approval limits |
| Cross-token Swap Provider | Swap spread + channel fees | Registration requirement; higher stake = higher maxAmountIn cap |
| Lookup Service Provider | Per-call discovery fees | Registration requirement; higher stake = priority in search results |
| Bandwidth Relay Operator | Per-GB relay fees | Registration requirement; higher stake = higher throughput allocation |
| Compute Node Operator | Per-second compute fees | Registration requirement; higher stake = priority job scheduling |
| Energy Gateway Operator | Per-kWh energy trading fees | Registration requirement; higher stake = higher grid capacity allocation |
| KISSVM Script Validator | Per-validation fees | Registration requirement; higher stake = priority validation queue |
| Data Oracle Publisher | Per-feed subscription fees | Registration requirement; higher stake = higher feed reliability score |
| Industrial Action Executor | Per-execution validation fees | Registration requirement; higher stake = higher action value cap |
| Governance Delegate | Delegation fees from voting power | Minimum stake to accept delegations; higher stake = more delegation capacity |

**Illustrative staking tiers:**

| Provider Type | Minimum TOTEM Stake | Fee Share Multiplier |
|--------------|-------------------|---------------------|
| Router Node | 1,000 TOTEM | 1.0× |
| SE Server | 500 TOTEM | 1.0× |
| Liquidity Pool Operator | 2,000 TOTEM | 1.0× |
| MachinePay Device Operator | 100 TOTEM | 0.5× |
| Premium Router (top 10% uptime) | 10,000 TOTEM | 2.0× |

### 3.4 Fee Distribution Architecture

The fee distribution system operates as a periodic settlement cycle:

```
                    ┌──────────────────────────┐
                    │     Fee Collection        │
                    │  (per operation/block)    │
                    └────────────┬─────────────┘
                                 │
                    ┌────────────▼─────────────┐
                    │    Fee Pool Aggregation   │
                    │  (per service category)   │
                    └────────────┬─────────────┘
                                 │
            ┌────────────────────┼────────────────────┐
            │                    │                    │
   ┌────────▼───────┐  ┌────────▼───────┐  ┌────────▼───────┐
   │  Operator Share │  │   LP Share     │  │ Treasury Share │
   │  (proportional  │  │ (proportional  │  │  (governance-  │
   │   to TOTEM stake)│  │  to MINIMA LP) │  │   determined)  │
   └────────┬───────┘  └────────┬───────┘  └────────┬───────┘
            │                    │                    │
   ┌────────▼───────┐  ┌────────▼───────┐  ┌────────▼───────┐
   │ Distributed to  │  │ Distributed to │  │  Protocol      │
   │ TOTEM stakers   │  │ MINIMA LPs     │  │  Treasury      │
   │ in TOTEM        │  │ in fee asset   │  │  (TOTEM)       │
   └────────────────┘  └────────────────┘  └────────────────┘
```

**Key design decisions:**
- **Operators earn in TOTEM.** This creates demand for TOTEM from service providers who need to stake more to earn more.
- **LPs earn in the fee asset** (typically MINIMA or the pooled token). This keeps LP incentives aligned with the underlying economic activity.
- **Treasury share funds protocol development.** A governance-determined percentage of all fees flows to the protocol treasury, denominated in TOTEM.

### 3.5 TOTEM Value Accrual Model

TOTEM's value is fundamentally tied to the net present value of future service revenue:

```
TOTEM Value = NPV(Future Service Revenue) / Circulating TOTEM Supply
```

Where:
- **Future Service Revenue** = Σ (Routing Fees + SE Fees + MachinePay Revenue + Pool Fees + Swap Spreads) across all providers
- **Circulating TOTEM Supply** = Total TOTEM issued minus treasury-held and permanently locked TOTEM

**Value drivers:**

| Driver | Effect on TOTEM Value |
|--------|----------------------|
| Network transaction volume ↑ | More routing fees → higher revenue → higher TOTEM value |
| Device count ↑ | More MachinePay revenue → higher revenue → higher TOTEM value |
| Statechain adoption ↑ | More SE operations → higher SE fees → higher TOTEM value |
| Liquidity pool TVL ↑ | More pool fees → higher revenue → higher TOTEM value |
| TOTEM staking ratio ↑ | Reduced circulating supply → higher TOTEM value per unit of revenue |
| Slashing events | Destroys slashed TOTEM → reduced supply → higher value per remaining TOTEM |
| Treasury buyback | Treasury uses fee revenue to buy and burn TOTEM → reduced supply |

### 3.6 TOTEM Supply Model

**Initial supply:** To be determined by governance at launch.

**Supply dynamics:**

| Mechanism | Effect on Supply |
|-----------|-----------------|
| Staking rewards (fee distribution) | No new issuance — rewards come from collected fees |
| Slashing | Destroys slashed TOTEM → deflationary |
| Treasury buyback & burn | Destroys TOTEM → deflationary |
| Provider registration | Locks TOTEM in stake → reduces circulating supply |
| Governance grants | Treasury distributes TOTEM for ecosystem development → inflationary (one-time) |

**Key property:** TOTEM has **no inflationary emissions.** All staking rewards come from real fee revenue, not from token minting. This means TOTEM staking yield is a function of network usage, not monetary policy. As network usage grows, yield grows. As network usage shrinks, yield shrinks. The token supply is naturally deflationary due to slashing and potential buyback-and-burn mechanisms.

---

## 4. Economic Flows

### 4.1 The Full Economic Cycle

```
                        ┌─────────────────┐
                        │   End User /    │
                        │   Customer      │
                        └────────┬────────┘
                                 │ Pays in MINIMA
                                 ▼
                        ┌─────────────────┐
                        │  Omnia Channel  │
                        │  (MINIMA-locked)│
                        └────────┬────────┘
                                 │
            ┌────────────────────┼────────────────────┐
            │                    │                    │
            ▼                    ▼                    ▼
   ┌────────────────┐  ┌────────────────┐  ┌────────────────┐
   │  Router Node   │  │  SE Server     │  │ MachinePay     │
   │  (TOTEM staked)│  │  (TOTEM staked)│  │ Device         │
   │                │  │                │  │ (TOTEM staked) │
   └───────┬────────┘  └───────┬────────┘  └───────┬────────┘
           │                   │                   │
           │ Earns routing     │ Earns SE fees     │ Earns service
           │ fees in MINIMA    │ in MINIMA         │ revenue in MINIMA
           │                   │                   │
           └───────────────────┼───────────────────┘
                               │
                               ▼
                      ┌─────────────────┐
                      │  Fee Collection │
                      │  (per epoch)    │
                      └────────┬────────┘
                               │
            ┌──────────────────┼──────────────────┐
            │                  │                  │
            ▼                  ▼                  ▼
   ┌────────────────┐  ┌────────────────┐  ┌────────────────┐
   │ Operator Share │  │   LP Share    │  │ Treasury Share │
   │  (TOTEM)       │  │  (MINIMA)     │  │   (TOTEM)      │
   └───────┬────────┘  └───────┬────────┘  └───────┬────────┘
           │                   │                   │
           ▼                   ▼                   ▼
   ┌────────────────┐  ┌────────────────┐  ┌────────────────┐
   │ TOTEM Stakers  │  │ MINIMA LPs    │  │ Protocol       │
   │ earn more TOTEM│  │ earn MINIMA   │  │ Development    │
   │ (stake compound)│  │ (withdrawable)│  │ & Buyback      │
   └────────────────┘  └────────────────┘  └────────────────┘
```

### 4.2 MINIMA Flow

```
MINIMA enters the ecosystem → Locked as collateral/bond/channel → Enables services → Services generate fees → Fees distributed to operators and LPs → Operators may re-stake MINIMA as additional collateral → Cycle continues
```

MINIMA circulates through the economy as the medium of exchange and store of collateral value. It enters via customer payments, gets locked in channels and bonds, and exits via operator withdrawals and LP redemptions.

### 4.3 TOTEM Flow

```
TOTEM staked by providers → Providers earn fee share in TOTEM → TOTEM can be re-staked (compound) or sold → New providers buy TOTEM to stake → Slashing destroys misbehaving providers' TOTEM → Treasury may buy back and burn TOTEM → Cycle continues
```

TOTEM circulates through the staking economy. It enters via provider registration, flows to operators as fee rewards, and exits via slashing and potential buyback-and-burn.

---

## 5. Value Accrual Mechanisms

### 5.1 Direct Value Accrual to TOTEM

| Mechanism | How It Works | Value Impact |
|-----------|-------------|-------------|
| **Fee distribution** | Operators earn TOTEM proportional to stake from collected fees | Direct revenue to stakers |
| **Staking requirement** | Providers must acquire and lock TOTEM to participate | Structural demand |
| **Slashing** | Misbehaving providers lose staked TOTEM | Deflationary supply pressure |
| **Treasury buyback** | Protocol uses fee revenue to buy TOTEM from market | Price support |
| **Governance premium** | TOTEM holders control protocol parameters | Governance value |

### 5.2 Indirect Value Accrual to MINIMA

| Mechanism | How It Works | Value Impact |
|-----------|-------------|-------------|
| **Collateral demand** | Every provider must lock MINIMA as bond | Structural demand |
| **Channel funding** | Every active channel locks MINIMA | Reduced circulating supply |
| **Liquidity pool TVL** | LPs lock MINIMA to earn fees | Reduced circulating supply |
| **Dispute bonds** | Challengers lock MINIMA during disputes | Temporary lockup |
| **On-chain settlement** | Final settlement burns MINIMA as fees | Deflationary pressure |

### 5.3 The Flywheel

```
More network usage
       │
       ▼
More fees generated ──────────────────┐
       │                              │
       ▼                              │
Higher TOTEM staking yield            │
       │                              │
       ▼                              │
More providers stake TOTEM            │
       │                              │
       ▼                              │
More MINIMA locked as collateral      │
       │                              │
       ▼                              │
Better service quality & reliability  │
       │                              │
       ▼                              │
More network usage ───────────────────┘
```

This flywheel is self-reinforcing. Network usage drives fee revenue. Fee revenue drives staking demand. Staking demand drives collateral lockup. Collateral lockup drives service quality. Service quality drives more network usage.

---

## 6. Governance and Treasury

### 6.1 TOTEM Governance

TOTEM holders govern the protocol through the `@totemsdk/governance` quadratic voting and liquid democracy system:

| Governable Parameter | Description |
|---------------------|-------------|
| `feeBps` floors | Minimum fee rates per service category |
| `minStake` requirements | Minimum TOTEM stake per provider type |
| `slashing conditions` | What constitutes slashable misbehavior |
| `challengerRewardBps` | Reward share for successful challengers |
| `treasuryAllocationBps` | Percentage of fees flowing to treasury |
| `operatorFeeBps` / `lpFeeBps` | Fee split between operators and LPs |
| `unbondingDurationBlocks` | How long bonds take to unbond |
| `providerRegistrationFee` | TOTEM fee to register as a provider |

### 6.2 Protocol Treasury

The protocol treasury is funded by a governance-determined percentage of all network fees. Treasury funds are used for:

1. **Protocol development** — funding core SDK development, security audits, and research
2. **Ecosystem grants** — funding dApps, tools, and integrations that grow network usage
3. **Buyback and burn** — purchasing TOTEM from the open market and burning it, returning value to stakers
4. **Insurance fund** — backstopping slashing events where the slashed amount is insufficient to cover consumer losses
5. **Liquidity provisioning** — seeding new liquidity pools to bootstrap economic activity

**Treasury allocation (illustrative):**

| Category | Allocation |
|----------|-----------|
| Protocol Development | 40% |
| Ecosystem Grants | 25% |
| Buyback & Burn | 20% |
| Insurance Fund | 10% |
| Liquidity Provisioning | 5% |

### 6.3 Quadratic Voting for Treasury Decisions

Treasury spending proposals are decided by TOTEM holders using quadratic voting. This prevents a single large holder from dominating treasury decisions:

- **Cost to vote:** `cost = votes²` (e.g., 10 votes cost 100 credits)
- **Credit source:** TOTEM stake weight or fixed credit pool
- **Quorum:** Configurable (e.g., 20% of staked TOTEM must vote)
- **Pass threshold:** Configurable (e.g., 60% in favor)

---

## 7. The Machine Economy: Revenue Projections

### 7.1 Service Categories and Revenue Models

| Service | Pricing Model | Example Rate | Revenue Driver |
|---------|--------------|-------------|----------------|
| Omnia Routing | Per-hop fee (% of amount) | 0.1% per hop | Payment volume × hop count |
| SE Server | Per-operation fee (bps) | 10 bps | Statechain operations × avg value |
| Wi-Fi Hotspot | Per-MB | 50 sat/MB | Data consumed |
| Solar Inverter | Per-kWh | €0.12/kWh | Energy produced |
| GPU Compute | Per-second | €0.01/sec | Compute time |
| Bandwidth Relay | Per-GB | 100 sat/GB | Data relayed |
| Sensor Data | Per-reading | €0.001/reading | Readings served |
| Cross-Token Swap | Spread + channel fees | Market-determined | Swap volume |

### 7.2 Illustrative Network Revenue Model

**Assumptions:**
- 10,000 active Omnia channels
- Average channel balance: 100 MIN
- Average daily payment volume per channel: 10 MIN
- Average routing hops: 3
- Routing fee: 0.1% per hop
- 1,000 SE servers processing 1,000 operations/day at avg 50 MIN
- 100,000 MachinePay devices at avg €0.50/day revenue
- 100 liquidity pools at 100,000 MIN TVL, 5% annualized fee generation

**Daily network revenue:**

| Source | Calculation | Daily Revenue |
|--------------------|-------------|
| Routing fees | 10,000 channels × 10 MIN × 3 hops × 0.1% | 3 MIN |
| SE fees | 1,000 servers × 1,000 ops × 50 MIN × 0.1% | 500 MIN |
| MachinePay | 100,000 devices × €0.50 | 50,000 MIN equivalent |
| Pool fees | 100 pools × 100,000 MIN × 5% / 365 | 1,370 MIN |
| Swap spreads | Variable | 100 MIN (estimate) |
| **Total** | | **~51,973 MIN/day** |

**Annualized:** ~19 million MIN in service revenue flowing through the network.

**TOTEM value implication:** If 20% of service revenue flows to TOTEM stakers (operator share), and TOTEM stakers demand a 10% annual yield on their stake, the implied TOTEM market cap is:

```
Annual TOTEM Revenue = 19,000,000 MIN × 20% = 3,800,000 MIN
Implied TOTEM Market Cap = 3,800,000 / 10% = 38,000,000 MIN
```

*This is illustrative only. Actual values depend on adoption, fee rates, staking ratios, and market-determined yield expectations.*

### 7.3 Growth Trajectory

| Phase | Timeframe | Active Channels | Daily Volume | Annual Revenue |
|-------|-----------|----------------|-------------|---------------|
| Bootstrap | Year 1 | 100 | 1,000 MIN | 36,500 MIN |
| Early Growth | Year 2 | 1,000 | 10,000 MIN | 365,000 MIN |
| Expansion | Year 3 | 10,000 | 100,000 MIN | 3,650,000 MIN |
| Maturity | Year 5 | 100,000 | 1,000,000 MIN | 36,500,000 MIN |
| Global Scale | Year 10 | 1,000,000 | 10,000,000 MIN | 365,000,000 MIN |

---

## 8. Risk Analysis

### 8.1 MINIMA-Specific Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| MINIMA price volatility | Medium | Provider bonds are operational costs, not speculative positions. Providers earn revenue in MINIMA, creating a natural hedge. |
| MINIMA liquidity crisis | Low | Channel factories and VTXO pools reduce on-chain footprint. Most economic activity is off-chain. |
| Quantum attack on Minima L1 | Low | WOTS+ signatures are quantum-resistant. The entire stack is quantum-resistant from day one. |
| Regulatory action against MINIMA | Medium | Totem Edge is infrastructure, not a financial product. Providers run their own nodes. No central entity to regulate. |

### 8.2 TOTEM-Specific Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Low initial staking participation | Medium | Bootstrap with treasury-funded staking rewards. Gradually transition to fee-only rewards. |
| Concentration of stake | Medium | Quadratic voting prevents governance capture. Liquid democracy allows small stakers to delegate. |
| Slashing disputes | Low | KISSVM-based adjudication with dispute bonds. Challengers have skin in the game. |
| Fee revenue below expectations | High | TOTEM has no inflationary emissions. If revenue is low, yield is low. This is a feature, not a bug — it means TOTEM value accurately reflects network usage. |
| Regulatory classification as security | Medium | TOTEM is a utility token for service provision, not an investment contract. Revenue comes from services rendered, not from managerial efforts of others. |

### 8.3 Systemic Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| MINIMA-TOTEM correlation breakdown | Low | The two assets serve different functions. MINIMA demand is structural (collateral). TOTEM demand is revenue-driven (staking). They can decouple. |
| Network effect failure | High | Totem Edge competes with centralized payment infrastructure. Adoption is not guaranteed. |
| Protocol capture by large providers | Medium | Quadratic voting, liquid democracy, and slashing create checks on provider power. |

---

## 9. Roadmap

### 9.1 Phase 1: Foundation (Current — v0.1)

**Status:** Economic mechanisms defined, fee accounting implemented, distribution not yet automated.

- [x] Provider bond scoring model with MINIMA hard collateral
- [x] Liquidity bond fee models and risk haircuts
- [x] Omnia routing fee model
- [x] SE server fee model
- [x] MachinePay per-unit pricing
- [x] Governance quadratic voting and liquid democracy
- [x] KISSVM treasury templates (multi-sig, budget allocation, vesting, streaming)
- [ ] Automated fee distribution
- [ ] TOTEM token launch
- [ ] Staking contract

### 9.2 Phase 2: Token Launch (Target: 2026 Q4)

- [ ] TOTEM token genesis and initial distribution
- [ ] Staking contract deployment (KISSVM-based)
- [ ] Provider registration with TOTEM staking requirement
- [ ] Automated fee collection per epoch
- [ ] Fee distribution to TOTEM stakers (operator share)
- [ ] Fee distribution to MINIMA LPs (LP share)
- [ ] Treasury fee allocation
- [ ] Governance activation (TOTEM holders vote on protocol parameters)

### 9.3 Phase 3: Economic Maturity (Target: 2027)

- [ ] Slashing automation (KISSVM-based adjudication)
- [ ] Cross-token swap fee integration
- [ ] MachinePay revenue aggregation into TOTEM fee pools
- [ ] Treasury buyback and burn mechanism
- [ ] Insurance fund activation
- [ ] Liquidity pool seeding from treasury
- [ ] QVAC agent integration for dynamic fee optimization
- [ ] Cross-domain fee settlement (multi-jurisdictional)

### 9.4 Phase 4: Global Scale (Target: 2028+)

- [ ] Fully autonomous provider economics (QVAC-driven)
- [ ] Real-time fee markets (dynamic pricing based on network congestion)
- [ ] Cross-chain fee settlement (TOTEM on other L1s via bridges)
- [ ] Institutional-grade provider bonds (regulated entities)
- [ ] TOTEM as settlement asset for machine-to-machine commerce
- [ ] Decentralized insurance protocols on top of TOTEM staking

---

## Appendix A: KISSVM Economic Templates

The following KISSVM templates (implemented in `@totemsdk/kissvm` and `@totemsdk/recursive-mast`) provide the on-chain enforcement layer for the tokenomics model:

| Template | Economic Function |
|----------|------------------|
| `provider-bond` | Challenge/slash mechanism with dispute bonds, adjudication, and treasury distribution |
| `liquidity-lock` | Enforces LP commitment status, unlock blocks, and provider signatures |
| `fee-accrual` | Pro-rata fee calculation: `rate × elapsed / totalPeriod` |
| `withdrawal` | Enforces lock terms, early withdrawal penalties, and provider signatures |
| `treasury-multisig` | N-of-M custodians with per-period spending limits |
| `treasury-budget` | Category envelopes with per-category caps and fiscal period enforcement |
| `treasury-vesting` | Cliff + linear vesting: `vested = total × elapsed / vestingBlocks` |
| `treasury-streaming` | Continuous payment: `streamed = elapsed × ratePerBlock` |
| `treasury-delegation` | Authority delegation with per-delegate max amounts and scope restrictions |
| `position-state-machine` | 9-status lifecycle with governance-controlled transitions |

---

## Appendix B: Comparison with Existing Token Models

| Feature | Totem Edge (TOTEM) | Ethereum (ETH) | Uniswap (UNI) | Chainlink (LINK) | Helium (HNT) |
|---------|-------------------|----------------|---------------|-----------------|-------------|
| Primary function | Service revenue token | Gas + collateral | Governance | Oracle payment | Network coverage |
| Value source | Real service revenue | Network usage + speculation | Protocol fees (not yet active) | Oracle request fees | Data transfer fees |
| Inflationary? | No (fee-only rewards) | Yes (issuance - burn) | No (fixed supply) | No (fixed supply) | Yes (mining rewards) |
| Staking yield source | Collected fees | Issuance + tips + MEV | None (governance only) | None (payment only) | Data transfer fees |
| Slashing? | Yes (misbehavior) | Yes (validator downtime) | No | No | Yes (coverage failure) |
| Governance | Quadratic voting + liquid democracy | Token-weighted | Token-weighted | N/A | Token-weighted |
| Collateral asset | MINIMA (separate) | ETH (same asset) | N/A | N/A | HNT (same asset) |

**Key differentiator:** TOTEM is one of the few token models where staking yield comes exclusively from real service revenue, not from inflationary emissions. This makes TOTEM's value fundamentally tied to network usage rather than monetary policy.

---

*The Totem Tokenomics Gold Paper. A two-asset model for the machine economy — MINIMA as the sovereign collateral backbone, TOTEM as the service revenue token.*
