export interface BleTransportPort {
  startScanning(serviceUUIDs?: string[]): Promise<void>;
  stopScanning(): Promise<void>;
  connect(peripheralId: string): Promise<void>;
  disconnect(peripheralId: string): Promise<void>;
  discover(peripheralId: string): Promise<BleService[]>;
  read(peripheralId: string, serviceUuid: string, characteristicUuid: string): Promise<Uint8Array>;
  write(peripheralId: string, serviceUuid: string, characteristicUuid: string, data: Uint8Array): Promise<void>;
  subscribe(peripheralId: string, serviceUuid: string, characteristicUuid: string): Promise<void>;
  unsubscribe(peripheralId: string, serviceUuid: string, characteristicUuid: string): Promise<void>;
  onDiscover(handler: (peripheral: BlePeripheral) => void): () => void;
  onNotification(handler: (event: BleNotification) => void): () => void;
  onDisconnect(handler: (peripheralId: string) => void): () => void;
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
