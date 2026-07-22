/**
 * Matter transport port — injected by the caller.
 *
 * Matter (formerly Project CHIP) is a smart home standard supporting
 * BLE, WiFi, and Thread transports. The caller provides the Matter SDK.
 */

export interface MatterTransportPort {
  /** Initialise the Matter stack. */
  init(vendorId: number, productId: number): Promise<void>;
  /** Shutdown the Matter stack. */
  shutdown(): Promise<void>;
  /** Commission a device onto the fabric. */
  commission(device: MatterCommissionableDevice, setupCode: string): Promise<MatterNode>;
  /** Remove a device from the fabric. */
  decommission(nodeId: string): Promise<void>;
  /** Read an attribute from a node. */
  readAttribute(nodeId: string, endpointId: number, clusterId: number, attributeId: number): Promise<MatterAttributeValue>;
  /** Write an attribute to a node. */
  writeAttribute(nodeId: string, endpointId: number, clusterId: number, attributeId: number, value: unknown): Promise<void>;
  /** Subscribe to attribute changes. */
  subscribe(nodeId: string, endpointId: number, clusterId: number, attributeIds: number[], minInterval: number, maxInterval: number): Promise<MatterSubscription>;
  /** Invoke a command on a node. */
  invokeCommand(nodeId: string, endpointId: number, clusterId: number, commandId: number, args: unknown): Promise<unknown>;
  /** Register handler for commissioning events. */
  onCommissioned(handler: (node: MatterNode) => void): () => void;
  /** Register handler for errors. */
  onError(handler: (err: Error) => void): () => void;
}

export interface MatterCommissionableDevice {
  discriminator: number;
  vendorId: number;
  productId: number;
  pairingHint?: number;
  pairingInstruction?: string;
}

export interface MatterNode {
  nodeId: string;
  vendorId: number;
  productId: number;
  vendorName?: string;
  productName?: string;
  endpoints: MatterEndpoint[];
}

export interface MatterEndpoint {
  endpointId: number;
  deviceType: number;
  deviceTypeName?: string;
  clusters: MatterCluster[];
}

export interface MatterCluster {
  clusterId: number;
  clusterName?: string;
  attributes: MatterAttribute[];
  commands: MatterCommand[];
}

export interface MatterAttribute {
  attributeId: number;
  attributeName?: string;
  dataType: string;
  value: unknown;
}

export interface MatterCommand {
  commandId: number;
  commandName?: string;
  direction: 'client_to_server' | 'server_to_client';
}

export interface MatterAttributeValue {
  nodeId: string;
  endpointId: number;
  clusterId: number;
  attributeId: number;
  value: unknown;
  dataType: string;
  receivedAt: number;
}

export interface MatterSubscription {
  /** Register handler for attribute change reports. */
  onChange(handler: (reports: MatterAttributeValue[]) => void): () => void;
  /** Cancel the subscription. */
  cancel(): Promise<void>;
}
