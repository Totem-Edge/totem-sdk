/**
 * NFC transport port — injected by the caller.
 *
 * Platform-agnostic NFC interface covering the full NFC spec surface:
 * reader polling (ISO 14443), NDEF message exchange, secure-element
 * access via ISO 7816-4 APDUs, peer-to-peer (NFC-DEP / SNEP), and
 * host card emulation (HCE). Works with a PC/SC reader, an Android
 * NFC stack, Web NFC (browser), or platform-native NFC libraries.
 */

/** A detected NFC tag/card. */
export interface NfcTag {
  /** Stable handle for this tag while it is present. */
  id: string;
  /** Tag UID as hex string. */
  uid: string;
  /** Technology family, e.g. "iso14443a", "iso14443b", "felica". */
  tech: string;
  /** Time the tag was first detected (ms epoch). */
  detectedAt: number;
}

/** A tag tap / presence event. */
export interface NfcTagEvent {
  uid: string;
  id: string;
  timestamp: number;
  /** Signal quality, 0..1 (1 = strongest / closest). */
  proximity: number;
}

/** An NDEF record (TNF + type + payload). */
export interface NdefRecord {
  /** Type Name Format: 0x01 well-known, 0x02 mime, 0x03 uri, 0x04 external. */
  tnf: number;
  /** Record type, e.g. "U", "T", "text/plain". */
  type: string;
  payload: Uint8Array;
  /** Optional record identifier. */
  id?: string;
}

/** Host Card Emulation callback — respond to an ISO 7816-4 APDU sent by an external reader. */
export type HceApduHandler = (apdu: Uint8Array) => Promise<Uint8Array>;

export interface NfcTransportPort {
  /** Begin reader polling for tags. */
  startPolling(options?: { techs?: string[] }): Promise<void>;
  /** Stop reader polling. */
  stopPolling(): Promise<void>;
  /** Block until a tag appears, or timeoutMs elapses (returns null on timeout). */
  waitForTag(timeoutMs?: number): Promise<NfcTag | null>;
  /** Read NDEF messages off a present tag. */
  readNdef(tagId: string): Promise<NdefRecord[]>;
  /** Write an NDEF message to a present tag (contactless / re-writable tags). */
  writeNdef(tagId: string, records: NdefRecord[]): Promise<void>;
  /** Erase NDEF data from a present tag. */
  eraseNdef(tagId: string): Promise<void>;
  /** ISO 7816-4 APDU exchange with a secure-element tag (Type 4 capable). */
  transceive(tagId: string, apdu: Uint8Array): Promise<Uint8Array>;
  /** Register handler for new tag detection. */
  onTag(handler: (event: NfcTagEvent) => void): () => void;
  /** Register handler for tag removal. */
  onTagLost(handler: (event: { uid: string; timestamp: number }) => void): () => void;
  /** Register handler for errors. */
  onError(handler: (err: Error) => void): () => void;

  /** Peer-to-peer: put a message to a peer P2P target (NFC-DEP / SNEP LLCP). */
  putMessage(record: NdefRecord[]): Promise<void>;
  /** Register handler for inbound peer-to-peer messages. */
  onMessage(handler: (records: NdefRecord[]) => void): () => void;

  /** Host Card Emulation: serve an APDU handler to an external reader. */
  registerHceApduHandler(handler: HceApduHandler): Promise<void>;
  /** Stop serving host-card-emulation APDUs. */
  unregisterHceApduHandler(): Promise<void>;
}