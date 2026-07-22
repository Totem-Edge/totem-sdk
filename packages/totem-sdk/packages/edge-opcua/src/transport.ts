/**
 * OPC-UA transport port — injected by the caller.
 *
 * OPC-UA (IEC 62541) is a binary protocol for industrial automation.
 * Supports secure channels, sessions, node browsing, subscriptions,
 * and method calls. The caller provides the OPC-UA stack.
 */

export interface OpcuaTransportPort {
  /** Connect to an OPC-UA server endpoint. */
  connect(endpointUrl: string): Promise<void>;
  /** Disconnect and close the session. */
  disconnect(): Promise<void>;
  /** Browse the server's address space. */
  browse(nodeId: string): Promise<OpcuaNode[]>;
  /** Read the value of a node. */
  read(nodeId: string): Promise<OpcuaValue>;
  /** Write a value to a node. */
  write(nodeId: string, value: OpcuaValue): Promise<void>;
  /** Create a monitored item subscription. */
  subscribe(nodeIds: string[], samplingInterval: number): Promise<OpcuaSubscription>;
  /** Call a method on an object node. */
  call(objectId: string, methodId: string, args: OpcuaValue[]): Promise<OpcuaValue[]>;
  /** Register handler for session errors. */
  onError(handler: (err: Error) => void): () => void;
}

export interface OpcuaSubscription {
  /** Add nodes to the subscription. */
  addNodes(nodeIds: string[]): Promise<void>;
  /** Remove nodes from the subscription. */
  removeNodes(nodeIds: string[]): Promise<void>;
  /** Register handler for value changes. */
  onChange(handler: (events: OpcuaValueChange[]) => void): () => void;
  /** Destroy the subscription. */
  destroy(): Promise<void>;
}

export interface OpcuaNode {
  nodeId: string;
  browseName: string;
  displayName: string;
  nodeClass: string;
  dataType?: string;
  valueRank?: number;
  children?: OpcuaNode[];
}

export interface OpcuaValue {
  value: unknown;
  dataType: string;
  sourceTimestamp?: number;
  serverTimestamp?: number;
  statusCode?: number;
}

export interface OpcuaValueChange {
  nodeId: string;
  value: OpcuaValue;
  receivedAt: number;
}
