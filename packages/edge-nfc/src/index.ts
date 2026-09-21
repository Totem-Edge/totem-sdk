export type {
  NfcTransportPort,
  NfcTag,
  NfcTagEvent,
  NdefRecord,
  HceApduHandler,
} from './transport.js';

export {
  TNF_WELL_KNOWN,
  TNF_MIME,
  TNF_ABSOLUTE_URI,
  TNF_EXTERNAL,
  encodeNdefMessage,
  decodeNdefMessage,
} from './ndef.js';

export type { NfcGatewayConfig, NfcGateway } from './gateway.js';
export { createNfcGateway } from './gateway.js';