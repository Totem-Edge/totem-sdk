import { BleMeshLink } from '../mesh-link.js';
import type { BleNotification, BlePeripheral, BleService, BleTransportPort } from '../transport.js';

class MockTransport implements BleTransportPort {
  readonly writes: Array<{ peripheralId: string; characteristicUuid: string; data: Uint8Array }> = [];
  readonly subscribes: string[] = [];
  readonly unsubscribes: string[] = [];
  failWrite = false;
  private notifyHandlers: Array<(event: BleNotification) => void> = [];
  private disconnectHandlers: Array<(id: string) => void> = [];
  private errorHandlers: Array<(error: Error) => void> = [];
  private discoverHandlers: Array<(peripheral: BlePeripheral) => void> = [];

  startScanning(): Promise<void> { return Promise.resolve(); }
  stopScanning(): Promise<void> { return Promise.resolve(); }
  connect(): Promise<void> { return Promise.resolve(); }
  disconnect(): Promise<void> { return Promise.resolve(); }
  discover(): Promise<BleService[]> { return Promise.resolve([]); }
  read(): Promise<Uint8Array> { return Promise.resolve(new Uint8Array()); }

  write(peripheralId: string, _serviceUuid: string, characteristicUuid: string, data: Uint8Array): Promise<void> {
    if (this.failWrite) return Promise.reject(new Error('write failed'));
    this.writes.push({ peripheralId, characteristicUuid, data: data.slice() });
    return Promise.resolve();
  }

  subscribe(_peripheralId: string, _serviceUuid: string, characteristicUuid: string): Promise<void> {
    this.subscribes.push(characteristicUuid);
    return Promise.resolve();
  }

  unsubscribe(_peripheralId: string, _serviceUuid: string, characteristicUuid: string): Promise<void> {
    this.unsubscribes.push(characteristicUuid);
    return Promise.resolve();
  }

  onDiscover(handler: (peripheral: BlePeripheral) => void): () => void {
    this.discoverHandlers.push(handler);
    return () => { this.discoverHandlers = this.discoverHandlers.filter((h) => h !== handler); };
  }

  onNotification(handler: (event: BleNotification) => void): () => void {
    this.notifyHandlers.push(handler);
    return () => { this.notifyHandlers = this.notifyHandlers.filter((h) => h !== handler); };
  }

  onDisconnect(handler: (id: string) => void): () => void {
    this.disconnectHandlers.push(handler);
    return () => { this.disconnectHandlers = this.disconnectHandlers.filter((h) => h !== handler); };
  }

  onError(handler: (error: Error) => void): () => void {
    this.errorHandlers.push(handler);
    return () => { this.errorHandlers = this.errorHandlers.filter((h) => h !== handler); };
  }

  emit(event: Partial<BleNotification> & { peripheralId: string; characteristicUuid: string }): void {
    const full: BleNotification = {
      peripheralId: event.peripheralId,
      serviceUuid: event.serviceUuid ?? 'svc',
      characteristicUuid: event.characteristicUuid,
      value: event.value ?? new Uint8Array(),
      receivedAt: event.receivedAt ?? 0,
    };
    for (const handler of this.notifyHandlers) handler(full);
  }

  get notificationHandlers(): number {
    return this.notifyHandlers.length;
  }
}

const CONFIG = {
  peripheralId: 'peer-1',
  serviceUuid: 'svc',
  rxCharacteristicUuid: 'rx',
  txCharacteristicUuid: 'tx',
  mtu: 185,
};

describe('BleMeshLink', () => {
  test('subscribes to the TX characteristic on open and releases it on close', async () => {
    const transport = new MockTransport();
    const link = new BleMeshLink({ ...CONFIG, transport });
    await link.open();
    expect(transport.subscribes).toEqual(['tx']);
    expect(transport.notificationHandlers).toBe(1);
    await link.close();
    expect(transport.unsubscribes).toEqual(['tx']);
    expect(transport.notificationHandlers).toBe(0);
  });

  test('only accepts notifications for its own peer and characteristic', async () => {
    const transport = new MockTransport();
    const link = new BleMeshLink({ ...CONFIG, transport });
    await link.open();

    transport.emit({ peripheralId: 'peer-2', characteristicUuid: 'tx', value: new Uint8Array([1]) });
    transport.emit({ peripheralId: 'peer-1', characteristicUuid: 'other', value: new Uint8Array([2]) });
    transport.emit({ peripheralId: 'peer-1', serviceUuid: 'other-svc', characteristicUuid: 'tx', value: new Uint8Array([3]) });
    expect(link.receive()).toBeUndefined();

    transport.emit({ peripheralId: 'peer-1', characteristicUuid: 'tx', value: new Uint8Array([4, 5]) });
    expect(Array.from(link.receive() ?? [])).toEqual([4, 5]);
    expect(link.receive()).toBeUndefined();
  });

  test('writes packets to RX in order and serialises them', async () => {
    const transport = new MockTransport();
    const link = new BleMeshLink({ ...CONFIG, transport });
    await link.open();

    link.send(new Uint8Array([1]));
    link.send(new Uint8Array([2]));
    link.send(new Uint8Array([3]));
    await link.flush();

    expect(transport.writes.map((w) => w.characteristicUuid)).toEqual(['rx', 'rx', 'rx']);
    expect(transport.writes.map((w) => Array.from(w.data))).toEqual([[1], [2], [3]]);
    expect(link.pendingWrites).toBe(0);
  });

  test('refuses a packet larger than the MTU without writing', async () => {
    const transport = new MockTransport();
    const link = new BleMeshLink({ ...CONFIG, transport });
    await link.open();

    link.send(new Uint8Array(200));
    await link.flush();
    expect(transport.writes).toHaveLength(0);
    expect(link.lastError).toContain('MTU');
  });

  test('surfaces a write failure and drops the rest of the queue', async () => {
    const transport = new MockTransport();
    transport.failWrite = true;
    const link = new BleMeshLink({ ...CONFIG, transport });
    await link.open();

    link.send(new Uint8Array([1]));
    link.send(new Uint8Array([2]));
    await link.flush();
    expect(link.lastError).toContain('write failed');
    expect(link.pendingWrites).toBe(0);
  });

  test('defaults to the 185-byte ATT MTU', () => {
    const link = new BleMeshLink({ ...CONFIG, mtu: undefined, transport: new MockTransport() });
    expect(link.mtu).toBe(185);
  });
});
