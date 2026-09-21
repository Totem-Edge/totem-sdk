# @totemsdk/edge-nfc

Edge runtime adapter for NFC — NDEF read/write/erase, ISO 14443-4 APDU transceive, P2P, and Host Card Emulation.

## Install

```bash
npm install @totemsdk/edge-nfc
```

## Design

This package does **not** import `nfc-pcsc`, `nfc@one`, or any native NFC stack. All NFC hardware behaviour is injected via `NfcTransportPort`. The package handles tag lifecycle, NDEF record parsing/serialization, APDU exchanges, P2P messages, HCE registration, and proof generation.

## Quick start

```ts
import { createEdgeRuntime } from '@totemsdk/edge';
import { createNfcGateway, encodeNdefMessage } from '@totemsdk/edge-nfc';
import type { NfcTransportPort, NdefRecord } from '@totemsdk/edge-nfc';

// 1. Implement NfcTransportPort (e.g. using a native lib on Node.js/Android)
const transport: NfcTransportPort = {
  async startPolling(options) { /* start tag polling (optionally filtered by tech) */ },
  async stopPolling() { /* stop polling */ },
  async readNdef(tagId) { /* read NDEF records */ return []; },
  async writeNdef(tagId, records) { /* write NDEF records */ },
  async eraseNdef(tagId) { /* erase NDEF data */ },
  async transceive(tagId, apdu) { /* ISO 14443-4 APDU exchange */ return new Uint8Array(); },
  async putMessage(records) { /* send NDEF records over P2P */ },
  onTag(handler) { return () => {}; },
  onTagLost(handler) { return () => {}; },
  onMessage(handler) { return () => {}; },
  onError(handler) { return () => {}; },
};

// 2. Wire into Edge runtime
const runtime = createEdgeRuntime({
  deviceId: 'nfc-gateway-01',
  capabilities: createCapabilitySet(['transport:nfc', 'proof:create']),
  ports: { /* proof port */ },
});

// 3. Create gateway
const gateway = createNfcGateway({ runtime, transport, techs: ['iso14443a'] });
await gateway.start();
// Detected tags are available at gateway.tags ({ id, uid, tech, detectedAt })

// 4. Read NDEF
const result = await gateway.readNdef(gateway.tags[0].id);
console.log(result.data?.records); // NdefRecord[]

// 5. Write NDEF (text record)
const records: NdefRecord[] = [{ tnf: 0x01, type: 'T', payload: new Uint8Array([0x02, 0x65, 0x6e, ...0x48, 0x65, 0x6c, 0x6c, 0x6f]) }];
await gateway.writeNdef(gateway.tags[0].id, records);

// 6. Encode manually if you need the raw NDEF message bytes
const ndefBytes = encodeNdefMessage(records);
```

## Transport port

| Method | Description |
|--------|-------------|
| `startPolling(options?)` | Start tag polling, optionally filtered by NFC techs |
| `stopPolling()` | Stop polling |
| `waitForTag(timeoutMs?)` | Block until a tag is detected |
| `readNdef(tagId)` | Read NDEF records from a tag |
| `writeNdef(tagId, records)` | Write NDEF records to a tag |
| `eraseNdef(tagId)` | Erase NDEF data from a tag |
| `transceive(tagId, apdu)` | ISO 14443-4 APDU exchange with a secure element tag |
| `putMessage(records)` | Send NDEF records over P2P (peer-to-peer) |
| `onTag(handler)` | Called when a tag is detected |
| `onTagLost(handler)` | Called when a tag is removed from the field |
| `onMessage(handler)` | Called on inbound P2P message receipt |
| `onError(handler)` | Called on NFC stack errors |
| `registerHceApduHandler(handler)` | Register an APDU handler for Host Card Emulation |
| `unregisterHceApduHandler()` | Unregister the HCE APDU handler |

## NDEF helpers

`encodeNdefMessage(records)` and `decodeNdefMessage(bytes)` are bundled so you can serialize/parse NDEF messages without a native dependency.

## Capabilities

- `transport:nfc` — required for NFC transport

## License

MIT