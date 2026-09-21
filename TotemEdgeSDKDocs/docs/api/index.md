---
title: API Reference
sidebar_label: Package Index
description: "Auto-generated API reference for all @totemsdk/* packages."
---

# API Reference

Auto-generated from TypeScript sources via TypeDoc. Run `npm run generate` from `TotemEdgeSDKDocs/` to regenerate.

| Package | Description | Maturity |
|---------|-------------|----------|
| [`@totemsdk/agent-policy`](totemsdk-agent-policy/index.md) | Protobuf-based interface contracts for AI agent ↔ wallet communication | rc |
| [`@totemsdk/authority`](totemsdk-authority/index.md) | Deterministic authority engine — mandate verification, scope matching, usage tracking | v1 |
| [`@totemsdk/chain-provider`](totemsdk-chain-provider/index.md) | Unified ChainStateProvider interface — Hosted, PureMinima, and Composite strategies | rc |
| [`@totemsdk/connect`](totemsdk-connect/index.md) | Client-side SDK for Totem wallet browser extension — includes Edge capability layer | v1 |
| [`@totemsdk/core`](totemsdk-core/index.md) | Core cryptographic primitives — WOTS+, SHA3-256, TreeKey, BIP39, backed by Rust/WASM | v1 |
| [`@totemsdk/core-wasm`](totemsdk-core-wasm/index.md) | WOTS+ cryptographic engine compiled from Rust to WASM | v1 |
| [`@totemsdk/edge`](totemsdk-edge/index.md) | Unified developer-facing runtime — composes identity, manifest, wallet, payment, proof, lookup, and policy via injected ports | v1 |
| [`@totemsdk/edge-adapters`](totemsdk-edge-adapters/index.md) | Reference adapters bridging SDK packages to @totemsdk/edge port interfaces | rc |
| [`@totemsdk/edge-bacnet`](totemsdk-edge-bacnet/index.md) | Edge runtime adapter for BACnet — building automation, HVAC, device properties | rc |
| [`@totemsdk/edge-ble`](totemsdk-edge-ble/index.md) | Edge runtime adapter for BLE — wearables, beacons, proximity tracking | rc |
| [`@totemsdk/edge-can`](totemsdk-edge-can/index.md) | Edge runtime adapter for CAN bus — automotive, heavy machinery, socketcan | rc |
| [`@totemsdk/edge-coap`](totemsdk-edge-coap/index.md) | Edge runtime adapter for CoAP — constrained devices, RFC 7252, UDP transport | rc |
| [`@totemsdk/edge-grpc`](totemsdk-edge-grpc/index.md) | Edge runtime adapter for gRPC — service-to-service, cloud-to-edge control planes | rc |
| [`@totemsdk/edge-lorawan`](totemsdk-edge-lorawan/index.md) | Edge runtime adapter for LoRaWAN — agriculture, asset tracking, long-range sensors | rc |
| [`@totemsdk/edge-matter`](totemsdk-edge-matter/index.md) | Edge runtime adapter for Matter — smart home, multi-transport, fabric management | rc |
| [`@totemsdk/edge-modbus`](totemsdk-edge-modbus/index.md) | Edge runtime adapter for Modbus — PLCs, RTUs, industrial sensors over serial/TCP | rc |
| [`@totemsdk/edge-mqtt`](totemsdk-edge-mqtt/index.md) | MQTT adapter — Rust/WASM-backed canonicalization, topic matching, MachinePay arithmetic | rc |
| [`@totemsdk/edge-nfc`](totemsdk-edge-nfc/index.md) | Edge runtime adapter for NFC — NDEF read/write/erase, ISO 14443-4 APDU transceive, P2P, and Host Card Emulation | alpha |
| [`@totemsdk/edge-opcua`](totemsdk-edge-opcua/index.md) | Edge runtime adapter for OPC-UA — SCADA, factory floors, industrial automation | rc |
| [`@totemsdk/edge-ros2`](totemsdk-edge-ros2/index.md) | Edge runtime adapter for ROS 2 — robotics, DDS middleware, typed topics | rc |
| [`@totemsdk/governance`](totemsdk-governance/index.md) | Deterministic governance engine — quadratic voting, liquid democracy, delegation, mandate-bound proposal execution | rc |
| [`@totemsdk/identity`](totemsdk-identity/index.md) | Canonical identity and claims layer — who controls a manifest, device, or agent | v1 |
| [`@totemsdk/kissvm`](totemsdk-kissvm/index.md) | KISSVM v1 evaluator for Minima scripting — lexer, parser, VM, all opcodes, backed by Rust/WASM | v1 |
| [`@totemsdk/liquidity-bond`](totemsdk-liquidity-bond/index.md) | Deterministic, non-custodial LP position and productive liquidity record | rc |
| [`@totemsdk/lookup-client`](totemsdk-lookup-client/index.md) | Hyperswarm client for Totem lookup nodes — chain queries, real-time coin updates, TxPoW broadcast | rc |
| [`@totemsdk/lookup-node`](totemsdk-lookup-node/index.md) | Always-on personal lookup node — Hyperswarm, chain queries, COIN_UPDATE push, WOTS lease coordination | rc |
| [`@totemsdk/lookup-protocol`](totemsdk-lookup-protocol/index.md) | Wire protocol definitions for lookup node ↔ client communication | rc |
| [`@totemsdk/manifest`](totemsdk-manifest/index.md) | Canonical signed declaration format — apps, agent capabilities, dApps, edge services | v1 |
| [`@totemsdk/omnia`](totemsdk-omnia/index.md) | Omnia eltoo payment channel state machine — transport-agnostic, WOTS-safe, HTLC-ready | v1 |
| [`@totemsdk/omnia-factory`](totemsdk-omnia-factory/index.md) | Channel factory — N-of-N MULTISIG funding, virtual channel management, factory settlement | rc |
| [`@totemsdk/omnia-router`](totemsdk-omnia-router/index.md) | Multi-hop payment routing — single-token and cross-token paths over Omnia channels | rc |
| [`@totemsdk/omnia-splice`](totemsdk-omnia-splice/index.md) | Channel splicing — resize eltoo channels without close+reopen | rc |
| [`@totemsdk/omnia-vtxo`](totemsdk-omnia-vtxo/index.md) | Virtual UTXO / payment-pool claim layer — cash-like off-chain balance primitive | rc |
| [`@totemsdk/pear`](totemsdk-pear/index.md) | Bare/Pear runtime integration — storage, networking, lifecycle, Hyperdrive adapters | rc |
| [`@totemsdk/proof`](totemsdk-proof/index.md) | Portable proof layer — create, sign, verify, and anchor WOTS-signed proof envelopes on Minima | v1 |
| [`@totemsdk/proof-integritas`](totemsdk-proof-integritas/index.md) | Integritas v2 proof provider — hash stamping, checking, on-chain verification on Minima | v1 |
| [`@totemsdk/proofgraph`](totemsdk-proofgraph/index.md) | Local deterministic proof relationship graph — indexes proofs, identities, manifests into a content-addressed DAG | v1 |
| [`@totemsdk/provider-bond`](totemsdk-provider-bond/index.md) | Provider trust layer — prove, record, score and filter infrastructure providers | rc |
| [`@totemsdk/pubsub-transport`](totemsdk-pubsub-transport/index.md) | Pub/sub transport interfaces — IPubSubTransport, EventEmitterTransport, MockPubSubTransport | rc |
| [`@totemsdk/minima-rpc`](totemsdk-minima-rpc/index.md) | Fetch-based PureMinima RPC client — Bare/Pear/Node/browser compatible | rc |
| [`@totemsdk/realtime`](totemsdk-realtime/index.md) | Real-time balance streaming — WebSocket and HTTP fallback | rc |
| [`@totemsdk/recursive-mast`](totemsdk-recursive-mast/index.md) | Recursive MAST + PREVSTATE — composable policy trees, proof chains, state transitions, delegation | rc |
| [`@totemsdk/root-identity`](totemsdk-root-identity/index.md) | Single root identity controlling up to 64 on-chain addresses — cryptographically linked via 3-level TreeKeys | v1 |
| [`@totemsdk/se-server`](totemsdk-se-server/index.md) | Self-hostable Statechain Entity (SE) server — Mercury-protocol co-signer as Express app | rc |
| [`@totemsdk/server`](totemsdk-server/index.md) | Server-side SDK — signing, transaction building and submission via Axia | v1 |
| [`@totemsdk/statechain`](totemsdk-statechain/index.md) | Mercury-protocol state chain — privacy-preserving off-chain UTXO custody transfer with blind SE co-signatures | rc |
| [`@totemsdk/stream-transport`](totemsdk-stream-transport/index.md) | Transport adapters — IStreamTransport, NodeStream, WebSocket, WebRTC, Stdio, Hyperswarm, in-memory | rc |
| [`@totemsdk/tx-builder`](totemsdk-tx-builder/index.md) | Transaction builder for Minima — coin selection, multisig, WOTS signing | rc |
| [`@totemsdk/txpow`](totemsdk-txpow/index.md) | TxPoW envelope serialization and proof-of-work mining for Minima | v1 |
| [`@totemsdk/wallet-adapter`](totemsdk-wallet-adapter/index.md) | Abstract base class for Totem-compatible wallets — hardware bridges, mobile companions, institutional custody | v1 |
| [`@totemsdk/wots-lease`](totemsdk-wots-lease/index.md) | WOTS key-use coordination — canonical v3 watermark, provider-based lease safety | v1 |
| [`@totemsdk/edge-email`](totemsdk-edge-email/index.md) | Edge runtime adapter for email — IMAP/SMTP polling, notification delivery, command parsing, and sensor ingestion via email | rc |
| [`@totemsdk/industrial-action`](totemsdk-industrial-action/index.md) | Deterministic industrial action lifecycle for Totem Edge — converts governed intent into context-aware, bounded, verifiably executed operations on field devices and protocols | rc |
| [`@totemsdk/mcp-server`](totemsdk-mcp-server/index.md) | MCP server exposing the full Totem SDK package set — metadata, types, exports, dependency graphs, and scaffolding tools for 57 packages | rc |
| [`@totemsdk/omnia-host`](totemsdk-omnia-host/index.md) | Durable Omnia node daemon for channel lifecycle, routing, and control APIs | rc |
| [`@totemsdk/location-proof`](totemsdk-location-proof/index.md) | Generic location and movement proof primitives — device-neutral GPS/GNSS claims, confidence scoring, motion trails, and proof envelope integration | v1 |
| [`@totemsdk/spatial-proof`](totemsdk-spatial-proof/index.md) | Generic spatial relationship proof primitives — geometry hashes, geofence relations, route checks, and proof envelope integration | v1 |
| [`@totemsdk/raster-proof`](totemsdk-raster-proof/index.md) | Edge-capable raster and visual evidence proof primitives — asset hashes, tile Merkle roots, raster manifests, derived-layer provenance, and proof envelope integration | v1 |
| [`@totemsdk/omnia-pool`](totemsdk-omnia-pool/index.md) | Generic Omnia liquidity pool orchestration primitive for Totem SDK | rc |
| [`@totemsdk/intelligence`](totemsdk-intelligence/index.md) | Provider-neutral intelligence contracts — capabilities, operations, receipts, errors for local self-hosted AI inference | beta |
| [`@totemsdk/qvac`](totemsdk-qvac/index.md) | QVAC intelligence adapter — wraps @qvac/sdk into @totemsdk/intelligence provider-neutral contracts (with /edge and /raw subpaths) | beta |
| [`@totemsdk/storage`](totemsdk-storage/index.md) | Provider-neutral storage contracts and adapters — StorageError taxonomy, versioned codec, namespaces, transactions + CAS, artifact-boundary types with a pluggable ArtifactStoreBackend port | alpha |
| [`@totemsdk/observability`](totem-observability/index.md) | Drop-in observability for Totem-based dApps — trace propagation and batched telemetry | — |
| [`totem-extension/keyring`](totem-extension-keyring/index.md) | Totem Extension public keyring API — signing validator types and security boundary utilities | — |
