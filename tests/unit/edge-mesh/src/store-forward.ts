/**
 * Bounded store-and-forward queue with duplicate suppression.
 *
 * Keeps a device useful when peers come in and out of range: frames it has
 * already relayed are remembered for a TTL so they are not sent twice, and the
 * queue is bounded by bytes rather than messages so a large frame cannot
 * starve the buffer. Mirrors hawk-node/ble/store_forward.cpp.
 */

const FNV_OFFSET = 1469598103934665603n;
const FNV_PRIME = 1099511628211n;
const MASK64 = (1n << 64n) - 1n;

export function frameHash(frame: Uint8Array): bigint {
  let value = FNV_OFFSET;
  for (let i = 0; i < frame.length; i++) {
    value ^= BigInt(frame[i]);
    value = (value * FNV_PRIME) & MASK64;
  }
  return value;
}

interface Entry {
  frame: Uint8Array;
  key: bigint;
}

export class StoreAndForward {
  private readonly maxBytes: number;
  private readonly hops: number;
  private readonly ttl: number;
  private bytesQueued = 0;
  private queue: Entry[] = [];
  private readonly seenUntil = new Map<bigint, number>();

  constructor(maxBytes: number, maxHops: number, ttlMs: number) {
    this.maxBytes = maxBytes;
    this.hops = maxHops;
    this.ttl = ttlMs;
  }

  /** False when the frame is a duplicate, expired-or-seen, or too large. */
  add(frame: Uint8Array, nowMs: number): boolean {
    this.purge(nowMs);
    const key = frameHash(frame);
    if (this.seenUntil.has(key)) return false;
    if (frame.length > this.maxBytes) return false;

    while (this.queue.length > 0 && this.bytesQueued + frame.length > this.maxBytes) {
      const dropped = this.queue.shift();
      if (dropped) this.bytesQueued -= dropped.frame.length;
    }

    this.queue.push({ frame, key });
    this.bytesQueued += frame.length;
    this.seenUntil.set(key, nowMs + this.ttl);
    return true;
  }

  /** Frames to transmit now; the queue is emptied, the dedupe cache is kept. */
  take(nowMs: number): Uint8Array[] {
    this.purge(nowMs);
    const out = this.queue.map((entry) => entry.frame);
    this.queue = [];
    this.bytesQueued = 0;
    return out;
  }

  seen(frame: Uint8Array, nowMs: number): boolean {
    const until = this.seenUntil.get(frameHash(frame));
    return until !== undefined && nowMs < until;
  }

  get bytes(): number {
    return this.bytesQueued;
  }

  get count(): number {
    return this.queue.length;
  }

  get ttlMs(): number {
    return this.ttl;
  }

  get maxHops(): number {
    return this.hops;
  }

  private purge(nowMs: number): void {
    for (const [key, until] of this.seenUntil) {
      if (nowMs >= until) this.seenUntil.delete(key);
    }
  }
}
