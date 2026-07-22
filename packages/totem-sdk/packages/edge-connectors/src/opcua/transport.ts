export interface OpcuaTransportPort {
  connect(endpointUrl: string): Promise<void>;
  disconnect(): Promise<void>;
  browse(nodeId: string): Promise<OpcuaNode[]>;
  readVariable(nodeId: string): Promise<OpcuaVariable>;
  writeVariable(nodeId: string, value: unknown, dataType?: string): Promise<void>;
  subscribe(nodeId: string, intervalMs: number): Promise<OpcuaSubscription>;
  onError(handler: (err: Error) => void): () => void;
}

export interface OpcuaNode {
  nodeId: string;
  browseName: string;
  displayName: string;
  nodeClass: string;
  children: OpcuaNode[];
}

export interface OpcuaVariable {
  nodeId: string;
  value: unknown;
  dataType: string;
  sourceTimestamp?: string;
  statusCode?: string;
}

export interface OpcuaSubscription {
  nodeId: string;
  onData(handler: (variable: OpcuaVariable) => void): void;
  cancel(): Promise<void>;
}
