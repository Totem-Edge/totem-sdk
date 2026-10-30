# @totemsdk/edge-modbus

Edge runtime adapter for Modbus — PLCs, RTUs, industrial sensors over serial/TCP.

## Install

```bash
npm install @totemsdk/edge-modbus
```

## Design

This package does **not** import `modbus-serial`, `net`, or `serialport`. All network/serial behaviour is injected via `ModbusTransportPort`. You provide the transport; the package handles framing, polling, and proof generation.

### Transport contract and recovery

`sendFrame` exchanges a **unit-prefixed PDU**, not a wire RTU/TCP frame:

- Request: `[unit, function, ...data]`; no MBAP header, CRC, or CRC placeholders.
- Read response: `[unit, function, byteCount, ...data]`.
- Write acknowledgement: `[unit, function, addressHi, addressLo, valueOrCountHi, valueOrCountLo]`.
- Exception response: `[unit, function | 0x80, exceptionCode]`.

Bindings own TCP transaction/protocol validation or RTU CRC validation. The Go
sidecar applies the requested unit ID under an exchange-wide lock, retains the
read byte count, validates actual device write echoes and applies configured
timeouts in both TCP and RTU modes. Broadcast unit zero is unsupported because
these APIs require a response. Update older bindings that append placeholder
CRC bytes when adopting this contract.

Invalid requests fail before I/O. Wrong-unit/function/length/echo responses fail.
Writes with a lost, malformed or mismatched acknowledgement return
`MODBUS_WRITE_OUTCOME_UNKNOWN`; they are sent once and never retried by the
gateway. Reconcile the device's actual state before authorizing another write.
A matching acknowledgement confirms the protocol exchange, not a physical
sensor's observed effect or RFC-022 policy approval.

Verification (build TypeScript before integration):

```bash
pnpm --filter @totemsdk/edge-modbus build
pnpm --filter @totemsdk/edge-modbus test --runInBand
pnpm --filter @totemsdk/edge-modbus test:go
pnpm --filter @totemsdk/edge-modbus test:integration
```

The integration test builds and launches the real Go process, connects ESM/CJS
gateways through JSON lines and exercises a loopback Modbus TCP simulator.
Go tests include concurrent unit routing under the race detector and independent
RTU CRC/framing vectors, including corruption, wrong-unit, truncation and size
bounds.

## Native sidecar distribution

The npm package does **not** bundle platform binaries or auto-download one.
`sidecar.json` is the machine-readable contract; the sidecar must be built from
the matching package source:

```bash
pnpm --filter @totemsdk/edge-modbus build:go
./packages/edge-modbus/bin/edge-modbus --version  # edge-modbus protocol=1
```

Set `MODBUS_MODE`, `MODBUS_LISTEN_ADDR`, `MODBUS_TCP_ADDR` or serial settings,
and `MODBUS_TIMEOUT_MS`. A protocol-major mismatch or unavailable binary must
block startup; there is no fallback transport.

Qualified evidence currently covers a macOS arm64 source build and loopback TCP
simulator, plus RTU codec/CRC unit tests. Serial hardware, Windows/Linux prebuilt
binaries, a vendor PLC matrix, and hot upgrade/rolling replacement remain
unqualified and must not be claimed as production-supported.

## Quick start

```ts
import { createEdgeRuntime, createEdgeDevice, createCapabilitySet } from '@totemsdk/edge';
import { createModbusGateway, createModbusSensorBridge } from '@totemsdk/edge-modbus';
import type { ModbusTransportPort } from '@totemsdk/edge-modbus';

// 1. Implement ModbusTransportPort for your environment
const transport: ModbusTransportPort = {
  async connect() { /* open TCP socket or serial port */ },
  async disconnect() { /* close */ },
  async sendFrame(frame) { /* exchange unit-prefixed PDU, return validated response */ },
  onFrame(handler) { /* register inbound frame handler */ return () => {}; },
  onError(handler) { /* register error handler */ return () => {}; },
};

// 2. Wire into Edge runtime
const runtime = createEdgeRuntime({
  deviceId: 'plc-gateway-01',
  capabilities: createCapabilitySet(['transport:modbus', 'proof:create']),
  ports: { /* proof port from edge-adapters */ },
});

// 3. Create gateway
const gateway = createModbusGateway({ runtime, transport });
await gateway.start();

// 4. Read registers
const result = await gateway.readHoldingRegisters(1, 0, 10);
console.log(result.data?.values); // [123, 456, ...]

// 5. Or use the sensor bridge for automated polling + proof generation
const bridge = createModbusSensorBridge({
  runtime,
  transport,
  gateway,
  bindings: [
    { sensorId: 'temp-zone-1', unitId: 1, functionCode: 3, address: 0, count: 2, intervalMs: 5000, dataType: 'temperature', unit: '°C' },
    { sensorId: 'pump-status', unitId: 2, functionCode: 1, address: 0, count: 1, intervalMs: 1000, dataType: 'coil' },
  ],
});
await bridge.start();
```

## Transport port

You must implement `ModbusTransportPort`:

| Method | Description |
|--------|-------------|
| `connect()` | Open TCP socket (port 502) or serial port |
| `disconnect()` | Close the connection |
| `sendFrame(frame)` | Exchange unit-prefixed PDU bytes as specified above |
| `onFrame(handler)` | Register handler for unsolicited/inbound frames |
| `onError(handler)` | Register handler for connection errors |

## Supported function codes

| Code | Name | Gateway method |
|------|------|---------------|
| 1 | Read Coils | `readCoils(unitId, address, count)` |
| 2 | Read Discrete Inputs | `readDiscreteInputs(unitId, address, count)` |
| 3 | Read Holding Registers | `readHoldingRegisters(unitId, address, count)` |
| 4 | Read Input Registers | `readInputRegisters(unitId, address, count)` |
| 5 | Write Single Coil | `writeSingleCoil(unitId, address, value)` |
| 6 | Write Single Register | `writeSingleRegister(unitId, address, value)` |
| 15 | Write Multiple Coils | `writeMultipleCoils(unitId, address, values)` |
| 16 | Write Multiple Registers | `writeMultipleRegisters(unitId, address, values)` |

## Capabilities

- `transport:modbus` — required for Modbus transport

## License

Apache-2.0 — see [LICENSE](./LICENSE) and [NOTICE](./NOTICE).
