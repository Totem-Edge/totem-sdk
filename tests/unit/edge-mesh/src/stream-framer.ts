/**
 * Length-prefixed stream framing (`[length:u32][type:u8][body]`).
 *
 * The Minima node's TCP transport uses a 4-byte big-endian length that covers
 * the type byte and body. A bridge that tunnels node frames into mesh packets
 * needs to recover whole frames first; this is the TypeScript counterpart of
 * hawk-node/ble/stream_framer.cpp.
 */

export const LENGTH_PREFIX_BYTES = 4;
export const MAX_STREAM_FRAME = 8 << 20;

export class StreamFramer {
  private buffer: Uint8Array = new Uint8Array(0);

  push(data: Uint8Array): void {
    if (data.length === 0) return;
    const next = new Uint8Array(this.buffer.length + data.length);
    next.set(this.buffer, 0);
    next.set(data, this.buffer.length);
    this.buffer = next;
  }

  /** The whole frame including its 4-byte prefix, or undefined when short. */
  next(): Uint8Array | undefined {
    if (this.buffer.length < LENGTH_PREFIX_BYTES) return undefined;

    const length =
      ((this.buffer[0] << 24) | (this.buffer[1] << 16) | (this.buffer[2] << 8) | this.buffer[3]) >>> 0;

    if (length === 0 || length > MAX_STREAM_FRAME) {
      this.buffer = new Uint8Array(0);
      throw new Error('invalid Minima frame length on the bridge stream');
    }
    const total = LENGTH_PREFIX_BYTES + length;
    if (this.buffer.length < total) return undefined;

    const frame = this.buffer.slice(0, total);
    this.buffer = this.buffer.slice(total);
    return frame;
  }

  get buffered(): number {
    return this.buffer.length;
  }
}

/** Wrap a type + body into a wire frame (tests and the bridge). */
export function makeFrame(type: number, body: Uint8Array): Uint8Array {
  const length = 1 + body.length;
  if (length > MAX_STREAM_FRAME) throw new Error('frame too large for the bridge');
  const frame = new Uint8Array(LENGTH_PREFIX_BYTES + length);
  frame[0] = (length >>> 24) & 0xff;
  frame[1] = (length >>> 16) & 0xff;
  frame[2] = (length >>> 8) & 0xff;
  frame[3] = length & 0xff;
  frame[4] = type;
  frame.set(body, LENGTH_PREFIX_BYTES + 1);
  return frame;
}
