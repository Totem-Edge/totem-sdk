/**
 * BLE transport port — injected by the caller.
 *
 * Platform-agnostic BLE interface. Works with noble (Node.js),
 * Web Bluetooth API (browser), or platform-native stacks.
 */

export interface BleTransportPort {
  /** Start scanning for peripherals. */
  startScanning(serviceUUIDs?: string[]): Promise<void>;
  /** Stop scanning. */
  stopScanning(): Promise<void>;
  /** Connect to a peripheral by ID or address. */
  connect(peripheralId: string): Promise<void>;
  /** Disconnect from a peripheral. */
  disconnect(peripheralId: string): Promise<void>;
  /** Discover services and characteristics. */
  discover(peripheralId: string): Promise<BleService[]>;
  /** Read a characteristic value. */
  read(peripheralId: string, serviceUuid: string, characteristicUuid: string): Promise<Uint8Array>;
  /** Write a characteristic value. */
  write(peripheralId: string, serviceUuid: string, characteristicUuid: string, data: Uint8Array): Promise<void>;
  /** Subscribe to characteristic notifications. */
  subscribe(peripheralId: string, serviceUuid: string, characteristicUuid: string): Promise<void>;
  /** Unsubscribe from characteristic notifications. */
  unsubscribe(peripheralId: string, serviceUuid: string, characteristicUuid: string): Promise<void>;
  /** Register handler for discovered peripherals. */
  onDiscover(handler: (peripheral: BlePeripheral) => void): () => void;
  /** Register handler for characteristic notifications. */
  onNotification(handler: (event: BleNotification) => void): () => void;
  /** Register handler for disconnection. */
  onDisconnect(handler: (peripheralId: string) => void): () => void;
  /** Register handler for errors. */
  onError(handler: (err: Error) => void): () => void;
}

export interface BlePeripheral {
  id: string;
  address: string;
  name?: string;
  rssi: number;
  services: string[];
}

export interface BleService {
  uuid: string;
  characteristics: BleCharacteristic[];
}

export interface BleCharacteristic {
  uuid: string;
  properties: string[];
}

export interface BleNotification {
  peripheralId: string;
  serviceUuid: string;
  characteristicUuid: string;
  value: Uint8Array;
  receivedAt: number;
}
