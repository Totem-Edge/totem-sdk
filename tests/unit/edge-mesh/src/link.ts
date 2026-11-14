/**
 * Transport seam for the edge mesh.
 *
 * A production link wraps whatever carries packets: a BLE GATT characteristic,
 * an NFC tap, a LoRaWAN chunked uplink, or a WebSocket. `VirtualLink` is the
 * in-memory link used by tests, so the framing and relay logic can be exercised
 * without radio hardware.
 */
export interface MeshLink {
  readonly mtu: number;
  send(packet: Uint8Array): void;
  receive(): Uint8Array | undefined;
}

export class VirtualLink implements MeshLink {
  readonly mtu: number;
  private readonly queue: Uint8Array[] = [];
  private dropped = 0;
  private dropNext = false;
  private corruptNext = false;

  constructor(mtu = 185) {
    if (mtu <= 16) throw new Error('MTU too small');
    this.mtu = mtu;
  }

  send(packet: Uint8Array): void {
    if (this.dropNext) {
      this.dropNext = false;
      this.dropped += 1;
      return;
    }
    if (packet.length > this.mtu) {
      this.dropped += 1;
      return;
    }
    const copy = packet.slice();
    if (this.corruptNext) {
      this.corruptNext = false;
      if (copy.length > 0) copy[copy.length - 1] ^= 0xff;
    }
    this.queue.push(copy);
  }

  receive(): Uint8Array | undefined {
    return this.queue.shift();
  }

  dropNextPacket(): void {
    this.dropNext = true;
  }

  corruptNextPacket(): void {
    this.corruptNext = true;
  }

  get droppedCount(): number {
    return this.dropped;
  }
}
