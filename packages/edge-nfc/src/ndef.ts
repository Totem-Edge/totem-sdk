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
  const idBytes = record.id ? enc8(record.id) : new Uint8Array(0);
  const payload = record.payload;
  const shortPayload = payload.length <= 0xff;

  const header = new Uint8Array(3 + typeBytes.length + idBytes.length);
  let o = 0;
  const flags =
    (first ? 0x80 : 0) |
    (last ? 0x40 : 0) |
    (shortPayload ? 0x10 : 0) |
    (record.id ? 0x08 : 0) |
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
  if (record.id) header[o++] = idBytes.length;
  header.set(typeBytes, o);
  o += typeBytes.length;
  if (record.id) {
    header.set(idBytes, o);
    o += idBytes.length;
  }
  return concat([header.subarray(0, o), payload]);
}

/** Parse an NDEF message byte stream into records. */
export function decodeNdefMessage(bytes: Uint8Array): NdefRecord[] {
  const records: NdefRecord[] = [];
  let o = 0;
  while (o < bytes.length) {
    const flags = bytes[o++];
    if (o > bytes.length) break;
    const tnf = flags & 0x07;
    const shortRecord = (flags & 0x10) !== 0;
    const il = (flags & 0x08) !== 0;

    if (o >= bytes.length) break;
    const typeLength = bytes[o++];
    let payloadLength: number;
    if (shortRecord) {
      payloadLength = bytes[o++] ?? 0;
    } else {
      if (o + 4 > bytes.length) break;
      payloadLength =
        ((bytes[o] << 24) |
          ((bytes[o + 1] << 16) >>> 0) |
          ((bytes[o + 2] << 8) >>> 0) |
          (bytes[o + 3] >>> 0)) >>> 0;
      o += 4;
    }
    const idLength = il ? (bytes[o++] ?? 0) : 0;
    const type = dec8(bytes.subarray(o, o + typeLength));
    o += typeLength;
    const id = il ? dec8(bytes.subarray(o, o + idLength)) : undefined;
    o += idLength;
    const payload = new Uint8Array(payloadLength);
    const end = Math.min(o + payloadLength, bytes.length);
    payload.set(bytes.subarray(o, end));
    o = end;
    records.push({ tnf, type, payload, id });
  }
  return records;
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