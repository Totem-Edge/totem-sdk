# Remaining Edge Adapter Ports

These 5 adapters need native binaries in languages other than Go/Rust.
Architecture is the same: local TCP socket + newline-delimited JSON + TypeScript Native*Transport.

| Protocol | Language | Library | Notes |
|----------|----------|---------|-------|
| BACnet   | C        | bacnet-stack | UDP multicast, device discovery, ASHRAE 135 spec |
| BLE      | Platform-native | BlueZ (Linux), CoreBluetooth (macOS) | No cross-platform library; separate binaries per OS |
| LoRaWAN  | C        | LoRaMAC-node | Hardware SPI to SX1276/SX1262, regional params, OTAA/ABPA |
| Matter   | C++      | CSA Matter SDK | Multi-transport (Thread/WiFi/Ethernet), commissioning, fabric mgmt |
| ROS 2    | C++      | rclcpp | DDS middleware, graph discovery, CDR serialization, ament/colcon build |

## Pattern to follow

Each adapter needs:
1. A native binary (language per table above) listening on a local TCP socket
2. Newline-delimited JSON protocol: `{"id":"...","type":"...",...}` → `{"id":"...","ok":true}`
3. TypeScript `Native*Transport` class implementing the existing `*TransportPort` interface
4. `build:<lang>` script in package.json
5. Config via environment variables

Reference implementations:
- Go binary pattern: `edge-modbus/go/main.go`
- Rust binary pattern: `edge-opcua/rust/src/main.rs`
- TypeScript transport pattern: `edge-modbus/src/native-transport.ts`
