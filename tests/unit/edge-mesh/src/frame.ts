/**
 * Packet framing for the BLE mesh: fragment a payload into MTU-sized packets
 * and reassemble it on the other side.
 *
 * Wire format (big-endian, 10-byte header):
 *
 *   magic 0xB7 | version 2 | hops u8 | msgId u16 | seq u16 | total u16 | crc16 u16
 *
 * Mirrors hawk-node/ble/frame_codec.cpp; see RFC-0018. The module is
 * transport-agnostic: a BLE GATT characteristic, an NFC tap or a LoRaWAN
 * uplink can all carry the packets.
 */
import { crc16 } from './crc16.js';

export const MAGIC = 0xb7;
export const VERSION = 2;
export const HEADER_BYTES = 11;
export const ATT_OVERHEAD = 3;
export const MAX_FRAME_BYTES = 1 << 20;
export const MAX_PENDING_MESSAGES = 32;
const MAX_FRAGMENTS = 0xffff;

export interface PacketHeader {
  magic: number;
  version: number;
  /** Relays traversed; a relay increments before forwarding. */
  hops: number;
  msgId: number;
  seq: number;
  total: number;
  crc: number;
}

export function encodeHeader(header: PacketHeader): Uint8Array {
  const out = new Uint8Array(HEADER_BYTES);
  out[0] = header.magic;
  out[1] = header.version;
  out[2] = header.hops & 0xff;
  out[3] = (header.msgId >> 8) & 0xff;
  out[4] = header.msgId & 0xff;
  out[5] = (header.seq >> 8) & 0xff;
  out[6] = header.seq & 0xff;
  out[7] = (header.total >> 8) & 0xff;
  out[8] = header.total & 0xff;
  out[9] = (header.crc >> 8) & 0xff;
  out[10] = header.crc & 0xff;
  return out;
}

function readU16(data: Uint8Array, offset: number): number {
  return ((data[offset] << 8) | data[offset + 1]) & 0xffff;
}

/** Returns the header only when it is well formed and self-consistent. */
export function decodeHeader(data: Uint8Array): PacketHeader | undefined {
  if (data.length < HEADER_BYTES) return undefined;
  const header: PacketHeader = {
    magic: data[0],
    version: data[1],
    hops: data[2],
    msgId: readU16(data, 3),
    seq: readU16(data, 5),
    total: readU16(data, 7),
    crc: readU16(data, 9),
  };
  if (header.magic !== MAGIC || header.version !== VERSION) return undefined;
  if (header.total === 0 || header.seq >= header.total) return undefined;
  return header;
}

/** A completed frame plus the hop count it arrived with. */
export interface AssembledFrame {
  bytes: Uint8Array;
  hops: number;
}

export class Fragmenter {
  readonly mtu: number;
  readonly payloadPerPacket: number;

  constructor(mtu: number) {
    if (mtu <= ATT_OVERHEAD + HEADER_BYTES) {
      throw new Error('BLE MTU too small for the mesh header');
    }
    this.mtu = mtu;
    this.payloadPerPacket = mtu - ATT_OVERHEAD - HEADER_BYTES;
  }

  maxFrameBytes(): number {
    return Math.min(MAX_FRAME_BYTES, MAX_FRAGMENTS * this.payloadPerPacket);
  }

  fragment(msgId: number, frame: Uint8Array, hops = 0): Uint8Array[] {
    if (frame.length > this.maxFrameBytes()) {
      throw new Error('frame exceeds the BLE mesh limit');
    }
    const total = frame.length === 0 ? 1 : Math.ceil(frame.length / this.payloadPerPacket);
    if (total > MAX_FRAGMENTS) throw new Error('frame needs too many fragments');

    const packets: Uint8Array[] = [];
    for (let seq = 0; seq < total; seq++) {
      const offset = seq * this.payloadPerPacket;
      const chunk = frame.subarray(offset, Math.min(offset + this.payloadPerPacket, frame.length));
      const header = encodeHeader({
        magic: MAGIC,
        version: VERSION,
        hops,
        msgId,
        seq,
        total,
        crc: crc16(chunk),
      });
      const packet = new Uint8Array(HEADER_BYTES + chunk.length);
      packet.set(header, 0);
      packet.set(chunk, HEADER_BYTES);
      packets.push(packet);
    }
    return packets;
  }
}

interface Partial {
  total: number;
  parts: Array<Uint8Array | undefined>;
  have: number;
  bytes: number;
  lastMs: number;
}

export class Reassembler {
  private readonly pendingSlots = new Map<number, Partial>();

  add(packet: Uint8Array, nowMs: number): AssembledFrame | undefined {
    const header = decodeHeader(packet);
    if (!header) return undefined;

    const payload = packet.subarray(HEADER_BYTES);
    if (payload.length > 0 && crc16(payload) !== header.crc) return undefined;

    let slot = this.pendingSlots.get(header.msgId);
    if (!slot) {
      if (this.pendingSlots.size >= MAX_PENDING_MESSAGES) {
        // C++ evicts std::map.begin(): the smallest msg id.
        let smallest = Infinity;
        for (const key of this.pendingSlots.keys()) smallest = Math.min(smallest, key);
        this.pendingSlots.delete(smallest);
      }
      slot = {
        total: header.total,
        parts: new Array<Uint8Array | undefined>(header.total),
        have: 0,
        bytes: 0,
        lastMs: nowMs,
      };
      this.pendingSlots.set(header.msgId, slot);
    }
    if (slot.total !== header.total) {
      slot.total = header.total;
      slot.parts = new Array<Uint8Array | undefined>(header.total);
      slot.have = 0;
      slot.bytes = 0;
    }

    if (slot.parts[header.seq] !== undefined) return undefined;  // duplicate
    slot.parts[header.seq] = payload;
    slot.bytes += payload.length;
    slot.have += 1;
    slot.lastMs = nowMs;

    if (slot.bytes > MAX_FRAME_BYTES) {
      this.pendingSlots.delete(header.msgId);
      return undefined;
    }
    if (slot.have !== slot.total) return undefined;

    const frame = new Uint8Array(slot.bytes);
    let offset = 0;
    for (const part of slot.parts) {
      if (!part) return undefined;  // unreachable when have === total
      frame.set(part, offset);
      offset += part.length;
    }
    this.pendingSlots.delete(header.msgId);
    return { bytes: frame, hops: header.hops };
  }

  expire(nowMs: number, ttlMs: number): void {
    for (const [msgId, slot] of this.pendingSlots) {
      if (nowMs > slot.lastMs && nowMs - slot.lastMs > ttlMs) {
        this.pendingSlots.delete(msgId);
      }
    }
  }

  get pending(): number {
    return this.pendingSlots.size;
  }
}
