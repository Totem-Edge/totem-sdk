export interface MatterTransportPort {
  init(vendorId: number, productId: number): Promise<void>;
  shutdown(): Promise<void>;
  commission(discriminator: number, setupCode: string): Promise<MatterNode>;
  readAttribute(nodeId: string, endpointId: number, clusterId: number, attributeId: number): Promise<MatterAttributeValue>;
  writeAttribute(nodeId: string, endpointId: number, clusterId: number, attributeId: number, value: unknown): Promise<void>;
  invokeCommand(nodeId: string, endpointId: number, clusterId: number, commandId: number, args: unknown): Promise<unknown>;
  subscribeAttribute(nodeId: string, endpointId: number, clusterId: number, attributeId: number, minInterval: number, maxInterval: number): Promise<MatterSubscription>;
  onCommissioned(handler: (node: MatterNode) => void): () => void;
  onError(handler: (err: Error) => void): () => void;
}

export interface MatterNode {
  nodeId: string;
  vendorId: number;
  productId: number;
  vendorName?: string;
  productName?: string;
  endpoints: MatterEndpoint[];
  isCommissioned: boolean;
}

export interface MatterEndpoint {
  endpointId: number;
  clusters: MatterCluster[];
}

export interface MatterCluster {
  clusterId: number;
  attributes: MatterAttribute[];
  commands: MatterCommand[];
}

export interface MatterAttribute {
  attributeId: number;
  type: string;
  access: 'read' | 'write' | 'read_write';
}

export interface MatterCommand {
  commandId: number;
  direction: 'request' | 'response';
}

export interface MatterAttributeValue {
  nodeId: string;
  endpointId: number;
  clusterId: number;
  attributeId: number;
  value: unknown;
  timestamp: number;
}

export interface MatterSubscription {
  nodeId: string;
  endpointId: number;
  clusterId: number;
  attributeId: number;
  onReport(handler: (value: MatterAttributeValue) => void): void;
  cancel(): Promise<void>;
}

export interface MatterCommissionableDevice {
  discriminator: number;
  vendorId: number;
  productId: number;
  deviceName?: string;
}
