/**
 * BACnet transport port — injected by the caller.
 *
 * BACnet (ASHRAE 135) is a building automation protocol.
 * Supports BACnet/IP (UDP 47808) and BACnet/MSTP (RS-485).
 * The caller provides the BACnet stack.
 */

export interface BacnetTransportPort {
  /** Initialise the BACnet stack. */
  init(deviceId: number, deviceName: string): Promise<void>;
  /** Shutdown the BACnet stack. */
  close(): Promise<void>;
  /** Discover devices on the network (Who-Is). */
  discoverDevices(): Promise<BacnetDevice[]>;
  /** Read a property from a remote device. */
  readProperty(deviceId: number, objectType: string, objectInstance: number, propertyId: number): Promise<BacnetPropertyValue>;
  /** Write a property to a remote device. */
  writeProperty(deviceId: number, objectType: string, objectInstance: number, propertyId: number, value: unknown, priority?: number): Promise<void>;
  /** Subscribe to COV (Change of Value) notifications. */
  subscribeCov(deviceId: number, objectType: string, objectInstance: number, lifetime?: number): Promise<BacnetSubscription>;
  /** Register handler for I-Am responses. */
  onDeviceDiscovered(handler: (device: BacnetDevice) => void): () => void;
  /** Register handler for errors. */
  onError(handler: (err: Error) => void): () => void;
}

export interface BacnetSubscription {
  /** Register handler for COV notifications. */
  onChange(handler: (event: BacnetCovNotification) => void): () => void;
  /** Cancel the subscription. */
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
