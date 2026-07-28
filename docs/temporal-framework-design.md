# Temporal Script Framework — Cross-Package Design

> Generalizes Vestr's block-arithmetic release pattern across every domain in the Totem SDK.

---

## 1. Core Primitive: The Temporal Template

Vestr's script uses `@BLOCK` arithmetic with `PREVSTATE`/`SAMESTATE` to derive a linear release curve. This same pattern, parameterized, generates 6 temporal primitives.

```
@BLOCK * totalAmount / vestingDuration  →  amountReleased
```

```typescript
// kissvm/src/templates/temporal.ts  (design sketch)

type ReleaseCurve =
  | 'linear'       // Vestr: amount * elapsed / duration
  | 'cliff'        // Nothing until cliffBlock, then linear
  | 'window'       // Only valid between startBlock and endBlock
  | 'deadline'     // Must claim by deadlineBlock, else forfeit
  | 'rate-limit'   // Max N per period, resets each period
  | 'decay'        // Hyperbolic: amount / (1 + k * elapsed)

interface TemporalConfig {
  curve: ReleaseCurve
  startPort: number       // STATE(startPort) = @BLOCK when clock starts
  endPort?: number        // STATE(endPort) = final block
  totalPort?: number      // STATE(totalPort) = total amount (for linear/cliff)
  beneficiaryPort?: number
  governancePort?: number // Optional governance override port
}

function buildTemporalScript(config: TemporalConfig): string {
  switch (config.curve) {
    case 'linear':
      return buildLinearRelease(config)
    case 'cliff':
      return buildCliffRelease(config)
    // …
  }
}

function computeRelease(
  block: bigint,
  state: Map<number, bigint>,
  curve: ReleaseCurve
): bigint {
  // Pure-function mirror of the script logic
  // Used by edge adapters and omnia for off-chain calculation
}
```

## 2. Temporal Integration Points: 6 Domains × 16 Packages

### 2.1 Edge Adapters (11 packages) — Sensor Data Monetization

Every edge adapter follows: `transport.ts` → `gateway.ts` → `sensor-bridge.ts` → `runtime.ports.proof.createProof()`.

**Integration:** Add a `runtime.ports.temporal` port + per-adapter temporal boundary on outgoing proofs.

```
Current:
  sensor-bridge → runtime.ports.proof.createProof(claims)

With Temporal:
  sensor-bridge → runtime.ports.temporal.computeRelease(block, state)
                → runtime.ports.proof.createProof(claims × releaseRatio)
```

#### Per-Adapter Temporal Mappings

| Adapter        | Temporal Concept                        | Curve      | Script Role                          |
|----------------|-----------------------------------------|------------|--------------------------------------|
| edge-bacnet    | COV subscription lifetime               | deadline   | Sensor data access expires           |
| edge-ble       | Peripheral advertisement window         | window     | Device visibility timebox            |
| edge-can       | CAN frame cyclic schedule               | rate-limit | Max frames per block                 |
| edge-coap      | Observe registration lifetime           | cliff+linear| CoAP observation monetization      |
| edge-email     | Polling interval / inbox sweep          | rate-limit | Max checks per period                |
| edge-grpc      | Service lease duration                  | deadline   | gRPC stream access expires           |
| edge-lorawan   | Device session keys TTL                 | cliff      | OTAA session validity (join→expiry)  |
| edge-matter    | Subscription minInterval/maxInterval    | window     | Matter attribute window              |
| edge-modbus    | TCP connection keepalive                | decay      | Connection value decays over idle    |
| edge-mqtt      | Usage metering period                   | rate-limit | MQTT message budget per block epoch  |
| edge-opcua     | Subscription sampling interval          | window     | OPC-UA data window licensing         |
| edge-ros2      | QoS deadline / Liveliness               | deadline    | ROS 2 DDS deadline enforcement       |

### 2.2 Omnia Channel Packages (5 packages)

| Package         | Current Temporal Logic                          | Temporal Template Integration               |
|-----------------|-------------------------------------------------|---------------------------------------------|
| omnia           | eltoo script: @COINAGE GTE 256 for settlement   | Replace hardcoded `@COINAGE` with `STATE(200)` = temporal cliff                                  |
| omnia-factory   | @COINAGE GTE 1 for settlement                   | Parameterize min-coinage via temporal window |
| omnia-router    | timeoutBlock decremented per HTLC hop           | Use temporal deadline for each HTLC         |
| omnia-splice    | STATE(101) reset to 0 after splice              | Temporal cooldown window before splice finalization |
| omnia-vtxo      | exitTimelockSeconds (86400s), expiresAt epochs  | temporal cliff for VTXO exit                |

### 2.3 Governance Package

Governance already has the richest temporal state machine (draft→active→passed→executed). Integration points:

| Component               | Temporal Template         | What Changes                                               |
|-------------------------|---------------------------|------------------------------------------------------------|
| Proposal lifecycle      | deadline + window          | votingStartsAt/votingEndsAt map to temporal.startBlock/endBlock |
| Delegation expiry       | cliff                      | expiresAt → temporal cliff at block N                      |
| UsageStore reservation  | deadline                   | TTL-reservation as temporal deadline script                |
| Membership expiry       | cliff                      | expiresAt blocks governance weight via temporal            |
| Execution delay         | linear                     | executionDelayMs → linear release of execution authority   |

### 2.4 Industrial-Action Package

| Component               | Temporal Template         | What Changes                                               |
|-------------------------|---------------------------|------------------------------------------------------------|
| Proposal expiry         | deadline                   | expiresAt → on-chain temporal deadline locking             |
| Context maxAge          | window                     | context staleness enforced via temporal window             |
| Execution timestamps    | linear                     | startedAt→completedAt as linear execution progress          |

### 2.5 tx-builder Package

| Component               | Temporal Template         | What Changes                                               |
|-------------------------|---------------------------|------------------------------------------------------------|
| Multisig expiry         | deadline                   | PendingMultisigTransaction.expiresAt → on-chain temporal   |
| Coin selection age      | linear                     | SpendableCoin.created → coin-age-based selection weighting |

### 2.6 Liquidity-Bond Package

| Component               | Temporal Template         | What Changes                                               | Status                     |
|-------------------------|---------------------------|------------------------------------------------------------|----------------------------|
| Lock terms              | cliff                     | `unlockAfterMs` → `unlockAfterBlock` via temporal cliff; `until-block`/`until-epoch` dead code brought to life via `STATE(0)` - `STATE(9)`                            | Dead code → active         |
| Position lifecycle      | window                    | Map 13 statuses to temporal windows (draft window, active window, quiescing cooldown)    | 7 statuses never assigned  |
| Fee accrual             | linear                    | Current fee model is `'record-only'` — replace with time-pro-rated linear accrual         | Only stored, never computed |
| Risk score TTE          | deadline                  | `computePositionRiskScore` uses `position.expiresAt - now` for penalty — replace with chain-block deadline                             | Implemented in wall-clock  |
| Withdrawal timing       | cliff                     | `position.createdAt + unlockAfterMs` → `STATE(vestStart) + unlockAfterBlocks`           | Wall-clock → chain-block   |
| Early withdrawal        | rate-limit                | `earlyWithdrawalPenaltyBps` is dead code — penalize via temporal rate-limit (max N early withdraws per epoch)                     | Dead code → active         |
| Haircut/Slashing        | deadline                  | `applyLiquidityHaircut` risk-weights only; slashing via temporal deadline (must claim by block else forfeit)                    | Risk-weight → enforcement  |

### 2.7 Provider-Bond Package

| Component               | Temporal Template         | What Changes                                               | Status                     |
|-------------------------|---------------------------|------------------------------------------------------------|----------------------------|
| Bond expiry             | deadline                  | `expiresAtBlock` is declared but never validated — enforce via `ASSERT @BLOCK LT expiresAtBlock`                                        | Dead code → active         |
| Bond lockup             | cliff                     | `future-l1-lock` lock type placeholder → temporal cliff: bond cannot be released before `cliffBlock`                                   | Placeholder → active       |
| Heartbeat window        | window                    | `MAX_HEARTBEAT_AGE_MS_DEFAULT` (120s wall-clock) → chain-block window: `ASSERT @BLOCK - lastHeartbeatBlock LT maxHeartbeatBlocks`     | Wall-clock → chain-block   |
| Scoring epochs          | rate-limit                | Current scoring is stateless/computed-on-demand → epoch-based scoring with max N score computations per epoch                         | Stateless → periodic       |
| Incident SLA            | deadline                  | Incident has `resolvedAt` but no response-window enforcement → enforce via `ASSERT @BLOCK LT createdAtBlock + slaBlocks`            | Record-only → enforced     |
| Bond release/maturation | linear                    | No unbonding/release logic exists → temporal linear release: bond amount released linearly over `unbondingDurationBlocks` after request | Not implemented → new      |
| Slashing timelock       | deadline                  | No slashing exists → forfeit window: challenger must prove misbehaviour before `challengeDeadlineBlock`                               | Not implemented → new      |
| Bond stack freshness    | deadline                  | `BondProofRef.expiresAt` is declared but not validated → enforce via `ASSERT @BLOCK LT expiresAt`                                      | Dead code → active         |

### 2.8 Core Script Descriptors

Current `ScriptDescriptor` has `timelockBlock`, `htlcHash`, `htlcPreimage`, `slowcashCooldown` — these map directly:

| Core Helper         | Temporal Curve     | Script Expression              |
|---------------------|--------------------|--------------------------------|
| TimelockHelper      | cliff              | `@BLOCK GT unlockBlock`        |
| HTLCHelper          | deadline           | `@BLOCK GT timeoutBlock`       |
| SlowCashHelper      | rate-limit         | `@COINAGE LT cooldownBlocks`   |
| FlashCashHelper     | deadline           | Single-block deadline           |

## 2.8 Temporal Payments Over Omnia

Payments flow through three layers: edge adapter payment port → L1/L2 routing → channel settlement. Each layer has distinct temporal patterns currently missing from the plan.

### 2.8.1 Payment Port Hierarchy

```
EdgePaymentPort.pay({recipient, amount, tokenId, memo?})   [edge/src/ports.ts:10]
  ├── Minima L1:  createMinimaL1PaymentPort()                    [payment-l1.ts]
  │    signs + broadcasts raw TxPoW → @BLOCK/@COINAGE scripts via core descriptors
  │
  └── Omnia L2:   createOmniaL2PaymentPort()                     [payment-l2.ts]
       routes over Omnia channels via multi-hop HTLCs
       temporal: getCurrentBlock(), expiryBlock = currentBlock + htlcTimeoutBlocks
```

### 2.8.2 Current Temporal Payment Surface (as-implemented)

| Component              | Temporal Field               | Curve     | Location                  | Notes |
|------------------------|------------------------------|-----------|---------------------------|-------|
| Omnia L2 payment port  | `expiryBlock`                | deadline  | payment-l2.ts:90          | `currentBlock + htlcTimeoutBlocks (default 144)` |
| Omnia L2 payment port  | `getCurrentBlock()`          | injection | payment-l2.ts:40          | Caller provides block height |
| omnia-router HTLC      | `timeoutBlock`               | deadline  | types.ts:24,59,201       | Per-hop timeout, decremented by position |
| omnia-router route     | `estimatedBlocks`            | metadata  | types.ts:169             | Informational only, not enforced |
| omnia-router execute   | `expiryBlock - BigInt(i)`    | deadline  | execute.ts:97,258,285    | Timeout decreases toward recipient |
| edge-mqtt usage-meter  | `settle()` batch payment     | none      | usage-meter.ts:52        | Accumulates usage → fires pay() on demand |
| Minima L1 payment port | none                        | none      | payment-l1.ts:40         | Pass-through to sign+broadcast |
| EdgePaymentPort        | none                        | none      | ports.ts:10              | No temporal params at all |

### 2.8.3 Temporal Payment Patterns (to be added)

#### Pattern 1: HTLC Curve Diversity

Currently all HTLCs use `deadline` (single `timeoutBlock`). The router would gain curve-parsed HTLCs:

```
HTLCParams.timeoutBlock         →  deadline (existing)
HTLCParams.cliffBlock            →  cliff (new: HTLC activates after cliffBlock)
HTLCParams.decayPerBlock         →  decay (new: value -= decayPerBlock per elapsed block)
HTLCParams.windowStart/End       →  window (new: HTLC only valid between blocks)
```

The temporal template generates the on-chain HTLC script. The router's `executeMultiHopPayment` would pass the curve type through to `ops.addHTLC()` so the channel script embeds the correct temporal constraint.

#### Pattern 2: Payment Channel State Machine Extension

Current eltoo channel script uses `STATE(100)=settlement`, `STATE(101)=sequence`, `@COINAGE GTE 256`. Temporal extension:

```
Port 102: rateLimitMax   — max state updates per epoch
Port 103: epochBlocks    — epoch duration in blocks
Port 104: autoSettleAt   — block at which channel auto-settles
Port 105: streamingRate  — amount per block for streaming payments
```

This enables:
- **Rate-limited channels**: `SAMESTATE(102,103)` check per update → enforce max updates/epoch
- **Auto-settling channels**: `ASSERT @BLOCK GTE STATE(104)` → force close at deadline
- **Streaming channels**: `STATE(105) * (@BLOCK - PREVSTATE(0)) / epochBlocks` → continuous payment

#### Pattern 3: Multi-Hop Routing Temporal Options

Current `RouteOptions` only has `maxHops`. New temporal route options:

```
interface RouteOptions {
  maxHops?: number
  // New temporal options:
  timePreference?: 'fastest' | 'cheapest' | 'balanced'  // routing optimization
  maxTimeDiscount?: bigint                                // reject routes where decay > this
  minExpiryBlocks?: bigint                                // minimum expiry for all hops
  routingDeadline?: bigint                                // must complete routing by block
  preferredEpoch?: bigint                                 // route within specific block window
}
```

The pathfinder (`pathfind.ts`) would use these to filter edges and rank routes.

#### Pattern 4: Streaming & Subscription Payments

New pattern over Omnia channels:

```typescript
interface StreamingPaymentConfig {
  channelId: string
  payerPkd: string
  payeePkd: string
  amountPerBlock: bigint
  totalBlocks: bigint
  settlementInterval: bigint   // e.g. settle every 144 blocks
}

// Temporal template: STREAMING
//  LET startBlock = STATE(0)
//  LET rate = STATE(5)         // amount per block
//  LET elapsed = SUB(@BLOCK startBlock)
//  LET due = MUL(rate elapsed)
//  LET prevPaid = PREVSTATE(6)
//  LET payment = SUB(due prevPaid)
//  ASSERT payment GT 0
//  ASSERT VERIFYOUT(@INPUT 0x{payee} payment @TOKENID TRUE)
//  STORE STATE(6, due)
```

This maps to the edge-mqtt usage-meter pattern: continuous accumulation → periodic settlement → on-chain proof.

#### Pattern 5: Edge Adapter → Payment Gate

Each adapter's temporal gate (Section 2.1 per-adapter table) conditions payment:

| Adapter gate curve | Payment trigger                 | Example                          |
|--------------------|----------------------------------|----------------------------------|
| deadline (COV)     | Data authorisation expires       | BACnet: "subscribe to temp data, pay per subscription window" |
| rate-limit (CAN)   | Max frames per block exceeded    | CAN: "you sent 100 frames this block, pay per extra frame" |
| cliff+linear (CoAP)| Observation window + rate        | CoAP: "free first 10 observations, then pay per observation" |
| window (Matter)    | Subscription interval expires    | Matter: "subscribe for 24h window, pay per window" |
| decay (Modbus)     | Connection idle value            | Modbus: "connection idle fees decay over time" |

The `EdgePaymentPort` would gain an optional `temporalConfig` parameter:

```typescript
interface EdgePaymentPort {
  pay(params: {
    recipient: string
    amount: string
    tokenId?: string
    memo?: string
    temporalConfig?: TemporalConfig  // NEW: temporal gate for this payment
  }): Promise<EdgeOperationResult<{ txpowId?: string }>>
}
```

#### Pattern 6: L1 → L2 Temporal Bridge

When L1 temporal scripts settle into L2 channels (and vice versa), temporal block arithmetic must be consistent:

```
L1 Minima chain                 L2 Omnia channel
─────────────────               ────────────────
@BLOCK                          channel block height (injected)
@COINAGE                        time since channel funded
STATE(port)                     channel.state.variables[port]
PREVSTATE(port)                 previous channel state variables
```

The bridge maps:
- `@BLOCK` → `getCurrentBlock()` from `chain-provider`
- `@COINAGE` → `currentBlock - fundedAtBlock` computed from channel metadata
- `STATE`/`PREVSTATE` → channel state variable ports (from channel's `stateVariables[]`)

This bridge is already partially implemented in `omnia/src/sign.ts:231-236` where `kissvm.evaluate(channel.fundingScript, stateVars)` is called during `verifyState`.

### 2.8.4 Temporal Payment Summary Table

| Pattern                     | Package(s)              | Temporal Curve     | New Integration |
|-----------------------------|-------------------------|--------------------|-----------------|
| HTLC curve diversity        | omnia-router            | cliff, decay, window | HTLCParams extended, executeMultiHopPayment curve-pass-through |
| Channel state extension     | omnia                   | rate-limit, deadline, linear | STATE(102-105), eltoo script extension |
| Multi-hop routing temporal  | omnia-router            | deadline, window   | RouteOptions extended, pathfind filtering |
| Streaming/subscription      | omnia, edge-mqtt       | linear, rate-limit | StreamingPaymentConfig, new temporal STREAM template |
| Adapter payment gate        | edge-*/sensor-bridge   | per-adapter (Sec 2.1) | EdgePaymentPort.temporalConfig, sensor-bridge gate |
| L1→L2 temporal bridge       | omnia, kissvm           | all curves         | chain-provider block → KISSVM @BLOCK substitution |
| Payment proof anchoring     | edge, edge-mqtt        | deadline           | EdgeReceipt includes block height at settlement |
| Time-discounted routing     | omnia-router            | decay              | Rate-based fee curves in ChannelGraphEdge.feeRate |
| Auto-settlement             | omnia-splice, omnia     | deadline           | Channel auto-closes at deadline block |
| Cross-token swap timing     | omnia-router            | deadline, cliff    | SwapAnnouncement rate expiry, cross-chain HTLC alignment |

## 3. Cross-Cutting Integration Architecture

### 3.1 EdgeRuntime Temporal Port

New port type added to `edge/src/ports.ts`:

```typescript
interface EdgeTemporalPort {
  computeRelease(config: TemporalConfig, block: bigint, state: Map<number, bigint>): bigint
  evaluateScript(script: string, state: StateValue[]): Promise<EvalResult>
}
```

This is the bridge between edge adapters and `@totemsdk/kissvm`. Every adapter that uses temporal scripts would optionally inject this port via `runtime.ports.temporal`.

### 3.2 Omnia KissvmEvaluator Extension

Current `KissvmEvaluator` in `omnia/src/types.ts`:

```typescript
interface KissvmEvaluator {
  evaluate(script: string, stateVariables: StateValue[]): Promise<{ result: boolean; error?: string }>
}
```

Extended with temporal helpers:

```typescript
interface KissvmEvaluator {
  evaluate(script: string, stateVariables: StateValue[]): Promise<{ result: boolean; error?: string }>
  // New temporal evaluation:
  evaluateTemporal(curve: ReleaseCurve, block: bigint, stateVariables: StateValue[]): Promise<bigint>
}
```

### 3.3 Channel State Variable Port Extension

Current omnia channels use `STATE(100) = settlement, STATE(101) = sequence`. Portal reservation:

| Port Range   | Purpose                    | Owner               |
|-------------|----------------------------|---------------------|
| 0-99        | Temporal scripts            | kissvm/temporal.ts  |
| 100-109     | Channel state               | omnia               |
| 110-199     | HTLC state                  | omnia-router        |
| 200-255     | Application-specific        | edge adapters       |

### 3.4 Canonical Hashing Bridge

`core/src/canonical.ts` (`toHex`, `canonicalJson`, `hashCanonical`) is already used by:
- governance (proposal/vote/outcome IDs)
- industrial-action (proposal/execution IDs)
- edge-mqtt (event IDs)
- omnia (state commitment via `computeStateCommitment`)

Temporal script IDs would use the same pattern:

```typescript
const temporalScriptId = hashCanonical('temporal.v1', {
  curve: 'linear',
  startBlock: 100000n,
  totalAmount: '1000',
  beneficiaryPubKey: '0x...'
})
```

### 3.5 MAST Integration

Temporal scripts are designed as MAST PolicyLayers in the `buildLayeredPolicy` pipeline:

```
temporal-layer → sensor-proof / payment-channel / state-machine
```

The 7-layer MAST policy chain (asset → manufacturer → product → regulatory → owner → site → operator) would gain an optional `TemporalConfig` at the operator layer to enforce temporal constraints on operator actions.

### 3.6 WOTS Lease Integration

`edge/src/ports.ts` defines `EdgeKeyLeasePort` (reserve→commit→burn). Temporal scripts use this for:
- **Reserve key slots** for time-locked outputs
- **Commit temporal authority** (e.g., "signer can only claim after deadlineBlock")
- **Burn expired temporal keys** after forfeiture

## 4. Script Generation Patterns

### 4.1 Linear Release (Vestr Pattern)

```kissvm
LET vestStart  = STATE(0)
LET total      = STATE(1)
LET prevClaimed = PREVSTATE(2)
LET elapsed    = SUB(@BLOCK vestStart)
LET vested     = DIV(MUL(total elapsed) total)
LET claimable  = SUB(vested prevClaimed)
ASSERT @BLOCK GT vestStart
ASSERT claimable GT 0
ASSERT SIGNEDBY(0x{bob})
ASSERT VERIFYOUT(@INPUT 0x{bob} claimable @TOKENID TRUE)
STORE STATE(2, ADD(prevClaimed claimable))
```

### 4.2 Cliff Release

```kissvm
LET vestStart   = STATE(0)
LET cliffBlock  = STATE(3)
LET total       = STATE(1)
LET prevClaimed = PREVSTATE(2)
ASSERT @BLOCK GT cliffBlock
LET fullElapsed  = SUB(@BLOCK vestStart)
LET cliffElapsed = SUB(@BLOCK cliffBlock)
LET vested = SUB(DIV(MUL(total fullElapsed) total)
                 DIV(MUL(total cliffElapsed) total))
LET claimable = SUB(vested prevClaimed)
ASSERT claimable GT 0
ASSERT SIGNEDBY(0x{bob})
ASSERT VERIFYOUT(@INPUT 0x{bob} claimable @TOKENID TRUE)
```

### 4.3 Deadline

```kissvm
LET deadlineBlock = STATE(4)
ASSERT @BLOCK GT deadlineBlock   ; // must claim before deadline⇐¬
ASSERT @BLOCK LT deadlineBlock   ; // (correct assertion)
ASSERT SIGNEDBY(0x{bob})
```

### 4.4 Window

```kissvm
LET windowStart = STATE(5)
LET windowEnd   = STATE(6)
ASSERT @BLOCK GTE windowStart
ASSERT @BLOCK LTE windowEnd
```

### 4.5 Rate-Limit

```kissvm
LET periodBlocks = STATE(7)
LET usedInPeriod = PREVSTATE(8)
LET currentBlock = @BLOCK
LET periodStart  = SUB(currentBlock MOD(currentBlock periodBlocks))
ASSERT SAMESTATE(8 8) OR @BLOCK IS NEW PERIOD  ; ; simplified
ASSERT usedInPeriod LT maxPerPeriod
STORE STATE(8, INC(usedInPeriod))
```

### 4.6 Decay (Hyperbolic)

```kissvm
LET vestStart = STATE(0)
LET total     = STATE(1)
LET k         = STATE(9)  ; decay constant
LET elapsed   = SUB(@BLOCK vestStart)
; value = total / (1 + k * elapsed)
LET numerator   = @MAX_DECIMAL
LET denominator = ADD(@MAX_DECIMAL MUL(k elapsed))
LET value       = DIV(MUL(total numerator) denominator)
```

## 5. Implementation Roadmap

### Phase 1: Core Template (kissvm)
1. Implement `temporal.ts` template with all 6 curves
2. Add `computeRelease()` off-chain helper
3. Add `TemporalConfig` type and validators
4. Existing `vestingWorkflow` in `prevstate.ts` serves as reference

### Phase 2: Edge Port
1. Add `EdgeTemporalPort` to `edge/src/ports.ts`
2. Wire temporal port to each adapter's gateway (optional injection)
3. Add temporal check in each adapter's `sensor-bridge.ts` before `createProof()`

### Phase 3: Bond Packages (liquidity-bond & provider-bond)
1. Replace all wall-clock `now ?? Date.now()` with chain-block `currentHeight` in temporal checks
2. Activate dead code: `unlockAfterBlock` on `LiquidityLockTerms` → temporal cliff; `expiresAtBlock` on `ProviderBondAssetDeclaration` → temporal deadline
3. Add temporal linear release for bond maturation (unbonding period)
4. Add temporal deadline for slashing/incentive enforcement
5. Add temporal window for heartbeat/probe recency (replace 120s constant with block window)
6. Bridge `@totemsdk/manifest` expiry verification ← temporal template validation

### Phase 4: Omnia Channel Temporal Extension
1. Add temporal state ports (0-99, 102-105) to omnia channel spec
2. Extend `KissvmEvaluator` interface with `evaluateTemporal()` and curve-specific evaluation
3. Replace hardcoded `@COINAGE GTE 256` in eltoo script with temporal parameter
4. Add temporal VTXO exit cliff in omnia-vtxo
5. Add `rateLimit`, `autoSettleAt`, `streamingRate` ports to eltoo script
6. Implement STREAMING temporal template for continuous channel payments

### Phase 5: Omnia Router HTLC & Pathfinding
1. Extend `HTLCParams` from single `timeoutBlock` deadline → cliff, decay, window curves
2. Extend `RouteOptions` with `timePreference`, `routingDeadline`, `minExpiryBlocks`
3. Add time-aware edge filtering + ranking in `pathfind.ts`
4. Pass HTLC curve type through `executeMultiHopPayment` → `ops.addHTLC()`
5. Add `SwapAnnouncement.rateExpiryBlock` for time-limited swap offers
6. Implement cross-token HTLC curve alignment in `executeCrossTokenPayment`

### Phase 6: Edge Payment Port Temporal
1. Add `temporalConfig?: TemporalConfig` to `EdgePaymentPort.pay()` params
2. Add `getCurrentBlock()` requirement to `EdgePaymentPort` (or inject via context)
3. Wire Minima L1 temporal script descriptors (`createTimelockDescriptor`, `createHTLCDescriptor`) into L1 payment port
4. Bridge edge-mqtt usage meter to streaming temporal template (continuous → block-epoch settlement)
5. Gate each edge adapter's sensor-bridge proof creation with temporal payment condition (per-adapter curves from Sec 2.1)

### Phase 7: Governance & Industrial-Action
1. Map governance state machine (draft→active→passed→executed) to temporal primitives
2. Add on-chain temporal locking for proposal execution delays
3. Add on-chain temporal for action expiry in industrial-action
4. Bridge governance mandate receipts to temporal proofs

### Phase 8: MAST Policy Layer
1. Add `temporalLayer()` to `kissvm/src/templates/layers.ts`
2. Integrate with `buildLayeredPolicy()` as an optional filter layer
3. Example: sensor-proof + temporal-rate-limit = data feed with budget

## 6. Key Observation: The MCP Server Gap

The `mcp-server` (`packages/mcp-server`) has **zero integration** with kissvm or temporal concepts. It is purely a static code indexer. No MCP tool accepts block height, constructs scripts, or evaluates state. This is the single largest integration gap — there is no way for external tools to:

- Query block height for temporal calculations
- Preview a temporal release schedule
- Simulate a temporal script spend

A future `mcp-server` tool like `simulate-temporal-spend(curve, block, state)` would close this gap.

## 7. Summary: Integration Surface Area

| Artifact                     | Location                                      | Temporal Integration |
|------------------------------|-----------------------------------------------|----------------------|
| Temporal template            | kissvm/src/templates/temporal.ts              | New: 6 curves        |
| Edge temporal port           | edge/src/ports.ts                             | New: EdgeTemporalPort|
| Edge adapters ×11           | edge-*/src/sensor-bridge.ts                   | Add temporal gate    |
| EdgePaymentPort temporal     | edge/src/ports.ts                             | Add `temporalConfig` param to `pay()` |
| Minima L1 temporal scripts   | edge-adapters/src/payment-l1.ts               | Add @BLOCK/@COINAGE script descriptors for temporal payments |
| Omnia L2 temporal expiry     | edge-adapters/src/payment-l2.ts               | `expiryBlock` + `getCurrentBlock()` → deadline curve |
| Omnia channel script         | omnia/src/script.ts                           | Replace @COINAGE, add STATE(102-105) for streaming/rate-limit |
| Omnia factory script         | omnia-factory/src/script.ts                   | Parameterize temporal settlement cooldown         |
| Omnia router HTLC            | omnia-router/src/types.ts                     | Extend from `deadline` only → cliff/decay/window  |
| Omnia router route options   | omnia-router/src/types.ts                     | Add `timePreference`, `routingDeadline`, `minExpiryBlocks` |
| Omnia router pathfind        | omnia-router/src/pathfind.ts                  | Time-aware edge filtering + ranking               |
| Omnia router execute         | omnia-router/src/execute.ts                   | Pass HTLC curve type through to `ops.addHTLC()`   |
| Omnia swap timing            | omnia-router/src/types.ts                     | `SwapAnnouncement.rateExpiryBlock` for time-limited swap offers |
| Streaming payments           | edge-mqtt/src/usage-meter.ts                  | Continuous accumulation → block-epoch streaming template |
| Cross-token HTLC alignment   | omnia-router/src/execute.ts                   | `executeCrossTokenPayment` curve alignment for both token sides |
| Omnia-vtxo exit              | omnia-vtxo/src/exit.ts                        | Add cliff            |
| Omnia-splice quiesce         | omnia-splice/src/quiesce.ts                   | Add cooldown window  |
| Governance proposal          | governance/src/proposal.ts                    | Map to cliff+window  |
| Governance execution         | governance/src/execution.ts                   | Map to deadline      |
| Industrial-action expiry     | industrial-action/src/proposal.ts             | Add deadline script  |
| Liquidity-bond lock terms    | liquidity-bond/src/types.ts                   | Activate dead `unlockAfterBlock`, `until-block`, `until-epoch` → temporal cliff  |
| Liquidity-bond fee accrual   | liquidity-bond/src/fees.ts                    | `record-only` → time-pro-rated linear via temporal                              |
| Liquidity-bond risk TTE      | liquidity-bond/src/risk.ts                    | Wall-clock TTE → chain-block deadline expiration                                 |
| Liquidity-bond slashing      | liquidity-bond/src/risk.ts                    | Risk-weight haircut → temporal deadline forfeit enforcement                       |
| Provider-bond bond expiry    | provider-bond/src/types.ts                    | Activate dead `expiresAtBlock` → temporal deadline                               |
| Provider-bond bond lockup    | provider-bond/src/types.ts                    | `future-l1-lock` → temporal cliff                                                |
| Provider-bond heartbeat      | provider-bond/src/scoring.ts                  | 120s wall-clock → chain-block window                                             |
| Provider-bond scoring epochs | provider-bond/src/scoring.ts                  | Stateless on-demand → epoch-based rate-limited                                   |
| Provider-bond incident SLA   | provider-bond/src/incidents.ts                | Record-only → temporal deadline enforcement                                      |
| Provider-bond bond release   | provider-bond/ (no existing file)             | New: temporal linear unbonding period                                            |
| Provider-bond slashing       | provider-bond/ (no existing file)             | New: temporal deadline forfeit window                                            |
| tx-builder multisig expiry   | tx-builder/src/multisig-manager.ts            | Map to deadline      |
| Core ScriptDescriptor        | core/src/scripts/types.ts                     | Already maps         |
| MAST layered policy          | kissvm/src/templates/layers.ts                | Add temporal layer   |
| Canonical hashing            | core/src/canonical.ts                         | Temporal script ID   |
| mcp-server                   | mcp-server/src/                               | Gap: no temporal MCP |
