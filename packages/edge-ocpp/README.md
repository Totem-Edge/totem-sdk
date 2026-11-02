# @totemsdk/edge-ocpp

Edge runtime adapter for OCPP — EV charging wire protocol and meter proofs.

> **Wire layer only.** This package frames and correlates OCPP-J messages. It
> has no decision, authority or physical-effect policy. Starting/stopping a
> charging session, setting limits or unlocking a connector must go through the
> governed `@totemsdk/act-ocpp` profile (RFC-024), built on `@totemsdk/act-core`.

## Install

```bash
npm install @totemsdk/edge-ocpp
```

## Design

A text-frame transport is injected via `OcppTransportPort`. The connector owns
OCPP-J framing, CALL/CALLRESULT/CALLERROR correlation, inbound CALL dispatch,
BootNotification, heartbeat and a meter-value bridge. The caller supplies the
WebSocket (or test) transport and OCPP version profile.

## Quick start

```ts
import { createOcppGateway, createOcppSensorBridge } from '@totemsdk/edge-ocpp';
import type { OcppTransportPort } from '@totemsdk/edge-ocpp';

const transport: OcppTransportPort = {
  async connect(url, protocols) { /* open WebSocket */ },
  async close() { /* close */ },
  async send(message) { /* send text frame */ },
  onMessage(handler) { /* return unsubscribe */ return () => {}; },
  onClose(handler) { return () => {}; },
  onError(handler) { return () => {}; },
};

const gateway = createOcppGateway({
  runtime,
  transport,
  url: 'wss://csms.example/ocpp/CP-1',
  chargePointId: 'CP-1',
});

await gateway.start(); // connects, sends BootNotification, starts heartbeat

const auth = await gateway.authorize('RFID-TAG');

gateway.onCall('RemoteStartTransaction', async (payload) => {
  // This handler is the *wire* response. It does not grant authority.
  return { status: 'Accepted' };
});

const meterBridge = createOcppSensorBridge({
  runtime,
  gateway,
  bindings: [{
    sensorId: 'energy-meter',
    connectorId: 1,
    intervalMs: 60_000,
    read: async () => [{ value: 12.5, unit: 'kWh', transactionId: 42 }],
  }],
});
await meterBridge.start();
```

## OCPP-J framing

```
CALL        [2, messageId, action, payload]
CALLRESULT  [3, messageId, payload]
CALLERROR   [4, messageId, errorCode, errorDescription, errorDetails]
```

`parseOcppFrame` validates the message type, id, action, payload shape and
error code. `OcppError` carries a valid OCPP error code and details.

## Gateway behaviour

- Boot is not successful unless the CSMS returns `status: "Accepted"`.
- Heartbeats are sent on the configured interval; failures mark the gateway
  `error`.
- Inbound CSMS calls are dispatched to registered handlers. An unmatched action
  receives `CallError NotSupported`; a handler throwing `OcppError` returns its
  code; other throws return `InternalError`.
- Calls time out with an explicit failure and connection loss rejects pending
  calls.
- Meter values are sent as standard `MeterValues` calls; the bridge also creates
  `sensor:<id>` proofs for each sample.

## Qualification status

`@totemsdk/edge-ocpp` is **RC**. The qualified profile covers OCPP-J framing,
boot/heartbeat, call correlation, inbound CALL dispatch, meter values, sensor
proofs and teardown against an injected transport simulator.

Not qualified: a real WebSocket/TLS transport, an OCPP stack/vendor matrix,
OCPP 2.0.1 transaction-event semantics, and any governed charging action. The
governed profile is a separate package (`act-ocpp`), required before this
connector may start, stop, limit or reserve charging.

## Testing

Tests live outside the published package. Package `test:*` scripts are
repository delegates; tests are not shipped.

- Unit (framing, gateway, bridge): `npm test`
- Simulator integration: `npm run test:integration`

## License

Apache-2.0 — see [LICENSE](./LICENSE) and [NOTICE](./NOTICE).
