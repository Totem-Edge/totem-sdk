/**
 * Message framing for Omnia P2P messages.
 *
 * Wire format (identical to @totemsdk/lookup-protocol framing):
 *   [4 bytes big-endian uint32 — byte length of JSON body]
 *   [N bytes UTF-8 JSON body]
 *
 * `peekFrameLength` and `FramingError` are reused from @totemsdk/lookup-protocol
 * to guarantee byte-exact wire format compatibility with the Totem SDK framing layer.
 *
 * `OmniaMessage` payloads carry `bigint` balance amounts, requiring a distinct
 * `{__bigint: "<decimal>"}` sentinel. This differs from LookupMessage which uses
 * `{__uint8array}` only. Both use the same 4-byte BE uint32 length prefix + UTF-8 JSON
 * wire format.
 */

import { peekFrameLength, FramingError, MAX_FRAME_BODY_LENGTH } from '@totemsdk/lookup-protocol';
import type { OmniaMessage } from './messaging-types.js';

export { FramingError };

/**
 * Accumulates raw incoming bytes and slices out complete length-prefixed
 * OmniaMessage frames. Not thread-safe — use one parser per stream.
 */
export class OmniaFrameParser {
  private _buf = new Uint8Array(0);

  push(chunk: Uint8Array): OmniaMessage[] {
    const combined = new Uint8Array(this._buf.length + chunk.length);
    combined.set(this._buf);
    combined.set(chunk, this._buf.length);
    this._buf = combined;

    const messages: OmniaMessage[] = [];
    while (this._buf.length >= 4) {
      const bodyLen = peekFrameLength(this._buf);
      if (bodyLen === null || this._buf.length < 4 + bodyLen) break;
      messages.push(_decodeOmniaFrame(this._buf.slice(0, 4 + bodyLen)));
      this._buf = this._buf.slice(4 + bodyLen);
    }
    return messages;
  }

  reset(): void {
    this._buf = new Uint8Array(0);
  }
}

/**
 * Encode an OmniaMessage to a length-prefixed frame.
 *
 * Sentinel encoding rules (applied recursively via JSON replacer):
 *   - `bigint`     → `{ __bigint: "<decimal string>" }`
 *   - `Uint8Array` → `{ __uint8array: "<hex string>" }`
 */
export function encodeOmniaMessage(msg: OmniaMessage): Uint8Array {
  const json = JSON.stringify(msg, (_key, value: unknown) => {
    if (typeof value === 'bigint') {
      return { __bigint: value.toString() };
    }
    if (value instanceof Uint8Array) {
      return { __uint8array: Buffer.from(value).toString('hex') };
    }
    return value;
  });
  const body = new TextEncoder().encode(json);
  const frame = new Uint8Array(4 + body.length);
  const view = new DataView(frame.buffer);
  view.setUint32(0, body.length, false);
  frame.set(body, 4);
  return frame;
}

function _decodeOmniaFrame(buf: Uint8Array): OmniaMessage {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const bodyLen = view.getUint32(0, false);
  if (bodyLen > MAX_FRAME_BODY_LENGTH) {
    throw new FramingError(`Omnia frame body length ${bodyLen} exceeds maximum ${MAX_FRAME_BODY_LENGTH}`);
  }
  const body = buf.slice(4, 4 + bodyLen);
  const json = new TextDecoder().decode(body);
  try {
    return JSON.parse(json, (_key, value: unknown) => {
      if (value !== null && typeof value === 'object') {
        if (
          '__bigint' in value &&
          typeof (value as { __bigint: unknown }).__bigint === 'string'
        ) {
          return BigInt((value as { __bigint: string }).__bigint);
        }
        if (
          '__uint8array' in value &&
          typeof (value as { __uint8array: unknown }).__uint8array === 'string'
        ) {
          return new Uint8Array(
            Buffer.from((value as { __uint8array: string }).__uint8array, 'hex'),
          );
        }
      }
      return value;
    }) as OmniaMessage;
  } catch (e) {
    throw new FramingError(`OmniaMessage JSON parse failed: ${String(e)}`);
  }
}
