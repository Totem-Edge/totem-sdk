# Edge Protocol Adapter Implementation Plan

## Architecture

Each adapter follows the `edge-mqtt` pattern, simplified:

```
edge-<protocol>/
  src/
    index.ts          — public exports
    transport.ts      — protocol-specific port interface
    gateway.ts        — wires transport → EdgeRuntime
    sensor-bridge.ts  — maps protocol messages → proof inputs
  package.json
  tsconfig.json
```

Common interface every adapter exposes:

```ts
interface EdgeProtocolAdapter {
  start(): Promise<void>;
  stop(): Promise<void>;
  readonly status: 'stopped' | 'running' | 'error';
}
```

## Phase 1 — Simple (stream/pubsub wrappers, ~50-100 LOC each)

These are thin adapters over existing transports. No external dependencies beyond what's already in the monorepo.

### 1.1 `edge-grpc`
- **Transport**: `IStreamTransport` (already have it)
- **Framing**: 1-byte compression flag + 4-byte BE length + protobuf body
- **Sensor bridge**: extract method name + payload, map to proof
- **Deps**: none (protobuf decoding is caller-injected)
- **Effort**: 2h

### 1.2 `edge-coap`
- **Transport**: UDP socket (injected, like MqttClientPort)
- **Framing**: 4-byte header + token + options + payload (RFC 7252)
- **Sensor bridge**: map CON/NON messages to proof inputs
- **Deps**: none (UDP is injected)
- **Effort**: 3h

### 1.3 `edge-modbus`
- **Transport**: serial port or TCP socket (injected)
- **Framing**: 7-byte MBAP header + function code + data (TCP) or raw RTU frames
- **Sensor bridge**: map function codes (read coils, read registers) to proof
- **Deps**: none (serial/TCP injected)
- **Effort**: 3h

## Phase 2 — Medium (protocol state machines, ~200-400 LOC each)

These need protocol-specific state machines but no native bindings.

### 2.1 `edge-can`
- **Transport**: socketcan (Linux) or PCAN (injected)
- **Framing**: 11/29-bit arbitration ID + DLC + data
- **Sensor bridge**: DBC decoding, ID filtering, signal extraction
- **Deps**: none (CAN interface injected)
- **Effort**: 4h

### 2.2 `edge-ble`
- **Transport**: platform BLE stack (injected — noble on Node, Web Bluetooth in browser)
- **Framing**: GATT services, characteristics, descriptors
- **Sensor bridge**: characteristic read/notify → proof
- **Deps**: none (BLE stack injected)
- **Effort**: 5h

### 2.3 `edge-lorawan`
- **Transport**: LoRa concentrator or network server API (injected)
- **Framing**: MHDR + MACPayload + MIC
- **Sensor bridge**: OTAA/ABP join, confirmed/unconfirmed uplink → proof
- **Deps**: none (radio/network injected)
- **Effort**: 4h

## Phase 3 — Complex (native bindings or external libraries, ~500-1000 LOC each)

These need significant protocol implementation or native library bindings.

### 3.1 `edge-ros2`
- **Transport**: DDS (eProsima Fast DDS or rmw layer, injected)
- **Framing**: RTPS messages with discovery, QoS, typed topics
- **Sensor bridge**: topic subscription → proof, service calls → proof
- **Deps**: ROS 2 client library (rclnodejs or custom DDS binding)
- **Effort**: 2-3 days

### 3.2 `edge-opcua`
- **Transport**: OPC-UA TCP binary protocol
- **Framing**: secure channel, session, node browsing, subscriptions
- **Sensor bridge**: monitored items → proof, method calls → proof
- **Deps**: node-opcua or custom implementation
- **Effort**: 2-3 days

### 3.3 `edge-matter`
- **Transport**: BLE + WiFi + Thread (multi-transport)
- **Framing**: Matter message format, commissioning, fabric management
- **Sensor bridge**: attribute reads, events → proof
- **Deps**: Matter SDK (C++ with Node.js bindings)
- **Effort**: 3-5 days

### 3.4 `edge-bacnet`
- **Transport**: BACnet/IP (UDP 47808) or BACnet/MSTP (RS-485)
- **Framing**: BVLC + NPDU + APDU
- **Sensor bridge**: read property, COV subscription → proof
- **Deps**: node-bacnet or custom implementation
- **Effort**: 2-3 days

## Capability strings to add

```
transport:grpc
transport:coap
transport:modbus
transport:can
transport:ble
transport:lorawan
transport:ros2
transport:opcua
transport:matter
transport:bacnet
```

## Implementation order

1. `edge-modbus` — simplest, establishes the pattern
2. `edge-grpc` — leverages existing stream transport
3. `edge-coap` — simple framing, common IoT protocol
4. `edge-can` — automotive/industrial, well-defined
5. `edge-ble` — ubiquitous, good test surface
6. `edge-lorawan` — agriculture/asset tracking
7. `edge-ros2` — robotics, highest-value complex protocol
8. `edge-opcua` — industrial automation
9. `edge-bacnet` — building automation
10. `edge-matter` — smart home, most complex

## Total effort estimate

| Phase | Packages | Effort |
|-------|----------|--------|
| Phase 1 | 3 | ~8h |
| Phase 2 | 3 | ~13h |
| Phase 3 | 4 | ~10-16 days |
| **Total** | **10** | **~12-18 days** |
