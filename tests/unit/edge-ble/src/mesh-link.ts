/**
 * Adapts a BLE GATT characteristic pair to the edge-mesh `MeshLink` seam.
 *
 * Packets are written to the peer's RX characteristic and arrive as
 * notifications on TX. Writes are serialised: BLE cannot take them in parallel,
 * and an unthrottled `write()` loop drops packets on most stacks.
 */
import type { MeshLink } from '@totemsdk/edge-mesh';

import type { BleTransportPort } from './transport.js';

export interface BleMeshLinkConfig {
  transport: BleTransportPort;
  peripheralId: string;
  serviceUuid: string;
  /** Characteristic the peer reads; packets are written here. */
  rxCharacteristicUuid: string;
  /** Characteristic we subscribe to; packets arrive here. */
  txCharacteristicUuid: string;
  /** ATT MTU. Defaults to 185, the usual negotiated value. */
  mtu?: number;
}

export class BleMeshLink implements MeshLink {
  readonly mtu: number;
  private readonly inbound: Uint8Array[] = [];
  private readonly outbound: Uint8Array[] = [];
  private unsubNotify: (() => void) | undefined;
  private pumping = false;
  private lastWriteError: string | undefined;

  constructor(private readonly config: BleMeshLinkConfig) {
    this.mtu = config.mtu ?? 185;
  }

  /** Subscribe to the peer's TX characteristic. */
  async open(): Promise<void> {
    if (this.unsubNotify) return;
    const { transport, peripheralId, serviceUuid, txCharacteristicUuid } = this.config;
    this.unsubNotify = transport.onNotification((event) => {
      if (event.peripheralId !== peripheralId) return;
      if (event.serviceUuid !== serviceUuid) return;
      if (event.characteristicUuid !== txCharacteristicUuid) return;
      this.inbound.push(event.value);
    });
    await transport.subscribe(peripheralId, serviceUuid, txCharacteristicUuid);
  }

  async close(): Promise<void> {
    const { transport, peripheralId, serviceUuid, txCharacteristicUuid } = this.config;
    if (this.unsubNotify) {
      this.unsubNotify();
      this.unsubNotify = undefined;
    }
    this.outbound.length = 0;
    this.inbound.length = 0;
    await transport.unsubscribe(peripheralId, serviceUuid, txCharacteristicUuid);
  }

  send(packet: Uint8Array): void {
    if (packet.length > this.mtu) {
      this.lastWriteError = `packet exceeds MTU ${this.mtu}`;
      return;
    }
    this.outbound.push(packet);
    void this.pump();
  }

  receive(): Uint8Array | undefined {
    return this.inbound.shift();
  }

  /** Resolves when every queued packet has been written (tests, flush points). */
  async flush(): Promise<void> {
    while (this.pumping || this.outbound.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  get lastError(): string | undefined {
    return this.lastWriteError;
  }

  get pendingWrites(): number {
    return this.outbound.length;
  }

  private async pump(): Promise<void> {
    if (this.pumping) return;
    this.pumping = true;
    try {
      const { transport, peripheralId, serviceUuid, rxCharacteristicUuid } = this.config;
      while (this.outbound.length > 0) {
        const packet = this.outbound[0];
        await transport.write(peripheralId, serviceUuid, rxCharacteristicUuid, packet);
        this.outbound.shift();
      }
    } catch (error) {
      this.lastWriteError = String(error);
      this.outbound.length = 0;
    } finally {
      this.pumping = false;
    }
  }
}
