# Totem Edge

**Verifiable infrastructure for Physical AI.**

Sensors read the world, machines act on it, and value moves because of it. Totem Edge is the open infrastructure that makes each step cryptographically provable — no central application cloud in the loop, no trusted third party, no post-hoc reconciliation they can't audit.

We are an implementation of Crystal Labs' platform thesis. Everything here is open-source, modular, and designed to be run on your own hardware.

## The one loop that matters

Physical systems don't work in "transactions". They work in **loops**:

**Sense → Prove → Decide → Act → Settle**

| Stage | What happens | What Totem provides |
|-------|--------------|---------------------|
| **Sense** | A device reads the world — temperature, pressure, position, energy, motion, telemetry. | Edge connectors for MQTT, Modbus, BACnet, CAN, BLE, LoRaWAN, OPC-UA, ROS 2, Matter, CoAP, gRPC, SMTP/IMAP |
| **Prove** | The reading becomes a signed, anchored, verifiable fact. | WOTS+ signatures, TreeKey identity, SHA3-256 digests, MMR/MAST proofs, proof graph |
| **Decide** | Policy decides whether the fact is acceptable — not a person in the loop, not a black box. | Recursive MAST policy trees, delegated authority chains, PREVSTATE state machines, KISSVM |
| **Act** | Bounded operational action against a real device or service. | Industrial action lifecycle with guardrails, edge runtime with injected ports |
| **Settle** | Value moves — micropayments, channel balances, dividends, bonds. | Eltoo payment channels (Omnia), HTLC/vault/treasury/membership/asset programs, statechains, routing |

Every stage produces evidence the next stage consumes. The evidence is produced by an open-source runtime, so there is no way to hide a step.

## Five systems

The platform is organised into five systems that map onto the loop:

1. **Edge** — the runtime and connectors that sense, and the port-injected execution boundary where action happens.
2. **Trust** — identity, signatures, proofs, and the cryptographic foundation everything else anchors to.
3. **Policy** — recursive MAST, delegated authority, governance, and agent-policy scopes that decide.
4. **Action** — the industrial-action lifecycle that turns governed intent into verifiably bounded operations.
5. **Settlement** — Omnia channels and the payment network that moves value when the loop completes.

> **Port injection is the moat.** The edge runtime has no network or protocol code baked in. Every transport — MQTT, Modbus, BLE, CAN, e-mail, a proprietary vendor SDK — plugs into a port. One runtime, provably identical logic, protocol adapters supplied by whoever needs them. The core is small, auditable, and identical everywhere; the surface extends forever.

## What Totem does not assume

- **No central application cloud.** Can be deployed without dependence on a central application cloud — your own lookup node, your own channel factory, your own infrastructure.
- **No trusted third party.** Signatures are produced on the device; policy is evaluated by a verifiable runtime; keys never leave the owner's environment.
- **No secret-keeping for keys you can't afford to lose.** The one-time-signature nature of WOTS is handled by lease coordination, not hope.
- **No hardware brand loyalty.** Everything is transport-agnostic. Swap the adapter, keep the logic.
- **No particular AI vendor.** Agents are separated from wallets by an explicit policy seam.

## Bounded machine agency

Totem is built for systems where machines act autonomously — but on a leash that is itself verifiable.

**AI proposes. Policy evaluates. Keys remain outside the agent.**

Agents never hold keys. An agent proposes a payment or an action; a policy engine evaluates it against scope, delegation, and budget; human keys (or governed hardware keys) produce the signature. The agency of the machine is bounded by the same cryptographic structures that make the evidence trustworthy.

## Why Minima?

The loop needs a substrate that keeps working when the cloud isn't watching.

- **Quantum-resistant by cryptographic construction.** WOTS+ signatures and an L-tree hierarchy are hash-based — no discrete-log assumptions to break.
- **UTXO-native.** Payments are settled by spending coins, which composes naturally with payment channels, statechains, and vaults.
- **Scriptable into the protocol.** KISSVM makes program invariants enforceable on-chain, not just in wallets.
- **Runs on commodity hardware.** A personal node is a few GB of RAM, not a data center.

Minima is the default substrate; the SDK's transport-agnostic core means the evidence layer speaks one language regardless of chain.

## Who we are

- **Crystal Labs** — the company.
- **Totem Edge** — the platform and the category (verifiable infrastructure for Physical AI).
- **Totem SDK** — the open-source implementation of the platform, in this repository.
- **Minima** — the substrate the platform anchors to by default.

## Get started

Technical details live in the [**Totem SDK**](https://github.com/Totem-Edge/totem-sdk). Start with the SDK's README for the architecture, package catalog, and quick start, or the docs index for the yellow/red/blue/green/grey papers and the RFCs.

**Website:** [totem.ing](https://totem.ing)