/**
 * NDEF helpers — encode / decode NFC Forum Tag Type 2 / Type 4 NDEF messages.
 *
 * Record header (1 byte):
 *   MB (0x80)  Message Begin
 *   ME (0x40)  Message End
 *   CF (0x20)  Chunk Flag
 *   SR (0x10)  Short Record  — payloadLength is a single byte
 *   IL (0x08)  ID Length Present
 *   TNF (0x07) Type Name Format (bits 0-2)
 */

import type { NdefRecord } from './transport.js';

export const TNF_WELL_KNOWN = 0x01;
export const TNF_MIME = 0x02;
export const TNF_ABSOLUTE_URI = 0x03;
export const TNF_EXTERNAL = 0x04;

/** Encode a list of records into an NDEF message byte stream. */
export function encodeNdefMessage(records: NdefRecord[]): Uint8Array {
  if (records.length === 0) return new Uint8Array(0);
  return concat(records.map((r, i) => encodeRecord(r, i === 0, i === records.length - 1)));
}

function encodeRecord(record: NdefRecord, first: boolean, last: boolean): Uint8Array {
  const typeBytes = enc8(record.type);
  const hasId = record.id !== undefined;
  const idBytes = hasId ? enc8(record.id ?? '') : new Uint8Array(0);
  const payload = record.payload;
  const shortPayload = payload.length <= 0xff;
  validateRecord(record.tnf, typeBytes.length, idBytes.length, payload.length);
  if (typeBytes.length > 0xff || idBytes.length > 0xff || payload.length > 0xffffffff) {
    throw new Error('NDEF type, ID or payload exceeds its encoded length field');
  }

  const header = new Uint8Array(2 + (shortPayload ? 1 : 4) + (hasId ? 1 : 0) + typeBytes.length + idBytes.length);
  let o = 0;
  const flags =
    (first ? 0x80 : 0) |
    (last ? 0x40 : 0) |
    (shortPayload ? 0x10 : 0) |
    (hasId ? 0x08 : 0) |
    record.tnf;
  header[o++] = flags;
  header[o++] = typeBytes.length;
  if (shortPayload) {
    header[o++] = payload.length;
  } else {
    header[o++] = (payload.length >>> 24) & 0xff;
    header[o++] = (payload.length >>> 16) & 0xff;
    header[o++] = (payload.length >>> 8) & 0xff;
    header[o++] = payload.length & 0xff;
  }
  if (hasId) header[o++] = idBytes.length;
  header.set(typeBytes, o);
  o += typeBytes.length;
  if (hasId) {
    header.set(idBytes, o);
    o += idBytes.length;
  }
  return concat([header.subarray(0, o), payload]);
}

/** Parse complete unchunked NDEF messages; malformed/truncated input throws. */
export function decodeNdefMessage(bytes: Uint8Array): NdefRecord[] {
  const records: NdefRecord[] = [];
  let o = 0;
  const requireBytes = (length: number): void => {
    if (length > bytes.length - o) throw new Error('Truncated NDEF message');
  };
  while (o < bytes.length) {
    requireBytes(2);
    const flags = bytes[o++];
    if (((flags & 0x80) !== 0) !== (records.length === 0)) throw new Error('Invalid NDEF message-begin flag');
    if ((flags & 0x20) !== 0) throw new Error('Chunked NDEF records are not supported');
    const tnf = flags & 0x07;
    const shortRecord = (flags & 0x10) !== 0;
    const il = (flags & 0x08) !== 0;

    const typeLength = bytes[o++];
    let payloadLength: number;
    if (shortRecord) {
      requireBytes(1);
      payloadLength = bytes[o++];
    } else {
      requireBytes(4);
      payloadLength = new DataView(bytes.buffer, bytes.byteOffset + o, 4).getUint32(0, false);
      o += 4;
    }
    if (il) requireBytes(1);
    const idLength = il ? bytes[o++] : 0;
    validateRecord(tnf, typeLength, idLength, payloadLength);
    // Validate the entire body before allocating a payload; declared lengths
    // from untrusted tags must not trigger huge allocations or zero-padding.
    requireBytes(typeLength + idLength + payloadLength);
    const type = dec8(bytes.subarray(o, o + typeLength));
    o += typeLength;
    const id = il ? dec8(bytes.subarray(o, o + idLength)) : undefined;
    o += idLength;
    const payload = bytes.slice(o, o + payloadLength);
    o += payloadLength;
    records.push({ tnf, type, payload, id });
    if ((flags & 0x40) !== 0) {
      if (o !== bytes.length) throw new Error('Trailing bytes after NDEF message end');
      return records;
    }
  }
  if (records.length) throw new Error('Missing NDEF message-end flag');
  return records;
}

function validateRecord(tnf: number, typeLength: number, idLength: number, payloadLength: number): void {
  if (!Number.isInteger(tnf) || tnf < 0 || tnf > 5) throw new Error('Unsupported or reserved NDEF TNF');
  if (tnf === 0 && (typeLength !== 0 || idLength !== 0 || payloadLength !== 0)) {
    throw new Error('NDEF empty record must not carry type, ID or payload');
  }
  if (tnf === 5 && typeLength !== 0) throw new Error('NDEF unknown record must not carry a type');
}

function enc8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function dec8(b: Uint8Array): string {
  return new TextDecoder().decode(b);
}

function concat(parts: Uint8Array[]): Uint8Array {
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
