export interface BacnetTransportPort {
  init(deviceId: number, deviceName: string): Promise<void>;
  close(): Promise<void>;
  discoverDevices(): Promise<BacnetDevice[]>;
  readProperty(deviceId: number, objectType: string, objectInstance: number, propertyId: number): Promise<BacnetPropertyValue>;
  writeProperty(deviceId: number, objectType: string, objectInstance: number, propertyId: number, value: unknown, priority?: number): Promise<void>;
  subscribeCov(deviceId: number, objectType: string, objectInstance: number, lifetime?: number): Promise<BacnetSubscription>;
  onDeviceDiscovered(handler: (device: BacnetDevice) => void): () => void;
  onError(handler: (err: Error) => void): () => void;
}

export interface BacnetSubscription {
  onChange(handler: (event: BacnetCovNotification) => void): () => void;
  cancel(): Promise<void>;
}

export interface BacnetDevice {
  deviceId: number;
  address: string;
  deviceName: string;
  vendorId: number;
  vendorName?: string;
  segmentsSupported?: string[];
}

export interface BacnetPropertyValue {
  objectType: string;
  objectInstance: number;
  propertyId: number;
  propertyName: string;
  value: unknown;
  dataType: string;
}

export interface BacnetCovNotification {
  deviceId: number;
  objectType: string;
  objectInstance: number;
  propertyId: number;
  newValue: unknown;
  receivedAt: number;
}
