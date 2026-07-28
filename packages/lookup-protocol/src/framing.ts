/**
 * Message framing for the lookup protocol.
 *
 * V1 wire format:
 *   [4 bytes big-endian uint32 — byte length of JSON body]
 *   [N bytes UTF-8 JSON body]
 *
 * Designed for streaming over Hyperswarm duplex streams (and any other
 * length-prefixed byte transport). Upgrade to msgpack can happen by bumping
 * PROTOCOL_VERSION without changing this length-prefix framing.
 */

import type { LookupMessage } from './messages.js';
import { PROTOCOL_VERSION } from './messages.js';

export const MAX_FRAME_BODY_LENGTH = 4_194_304; // 4 MiB

export class FramingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FramingError';
  }
}

/**
 * Encode a LookupMessage to a framed Uint8Array.
 * Stamps `version` onto the message if not already set.
 */
export function encodeMessage(msg: LookupMessage): Uint8Array {
  const stamped = { ...msg, version: msg.version ?? PROTOCOL_VERSION };
  const json = JSON.stringify(stamped, (_key, value) => {
    if (value instanceof Uint8Array) {
      return { __uint8array: Array.from(value) };
    }
    return value as unknown;
  });

  const body = new TextEncoder().encode(json);
  const frame = new Uint8Array(4 + body.length);
  const view = new DataView(frame.buffer);
  view.setUint32(0, body.length, false);
  frame.set(body, 4);
  return frame;
}

/**
 * Decode a framed buffer to a LookupMessage.
 * Expects exactly one framed message in the buffer.
 */
export function decodeMessage(buf: Uint8Array): LookupMessage {
  if (buf.length < 4) {
    throw new FramingError(`Buffer too short: ${buf.length} bytes`);
  }
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const bodyLen = view.getUint32(0, false);
  if (bodyLen > MAX_FRAME_BODY_LENGTH) {
    throw new FramingError(`Frame body length ${bodyLen} exceeds maximum ${MAX_FRAME_BODY_LENGTH}`);
  }
  if (buf.length < 4 + bodyLen) {
    throw new FramingError(
      `Incomplete frame: expected ${4 + bodyLen} bytes, got ${buf.length}`,
    );
  }
  const body = buf.slice(4, 4 + bodyLen);
  const json = new TextDecoder().decode(body);
  try {
    const parsed = JSON.parse(json, (_key, value: unknown) => {
      if (
        value !== null &&
        typeof value === 'object' &&
        '__uint8array' in value &&
        Array.isArray((value as { __uint8array: unknown }).__uint8array)
      ) {
        return new Uint8Array((value as { __uint8array: number[] }).__uint8array);
      }
      return value;
    }) as LookupMessage;
    return parsed;
  } catch (e) {
    throw new FramingError(`JSON parse failed: ${String(e)}`);
  }
}

/**
 * Read the declared body length from the first 4 bytes of a stream buffer.
 * Returns null if fewer than 4 bytes are available.
 * Useful for incremental stream parsers.
 */
export function peekFrameLength(buf: Uint8Array): number | null {
  if (buf.length < 4) return null;
  const view = new DataView(buf.buffer, buf.byteOffset, 4);
  const len = view.getUint32(0, false);
  if (len > MAX_FRAME_BODY_LENGTH) {
    throw new FramingError(`Frame body length ${len} exceeds maximum ${MAX_FRAME_BODY_LENGTH}`);
  }
  return len;
}
