export interface Ros2TransportPort {
  createNode(nodeName: string, namespace?: string): Promise<void>;
  destroyNode(): Promise<void>;
  publish(topic: string, message: Uint8Array, qos?: Ros2Qos): Promise<void>;
  subscribe(topic: string, qos?: Ros2Qos): Promise<Ros2Subscription>;
  createClient(service: string, requestType: string): Promise<Ros2Client>;
  createService(service: string, requestType: string, responseType: string, handler: (request: Uint8Array) => Promise<Uint8Array>): Promise<void>;
  spin(): Promise<void>;
  onError(handler: (err: Error) => void): () => void;
}

export interface Ros2Qos {
  reliability: 'reliable' | 'best_effort';
  durability: 'volatile' | 'transient_local';
  depth: number;
}

export interface Ros2Node {
  nodeName: string;
  namespace: string;
  topics: Ros2Topic[];
}

export interface Ros2Topic {
  name: string;
  type: string;
  qos: Ros2Qos;
}

export interface Ros2Subscription {
  topic: string;
  onMessage(handler: (message: Uint8Array) => void): void;
  cancel(): Promise<void>;
}

export interface Ros2Client {
  service: string;
  call(request: Uint8Array, timeoutMs?: number): Promise<Uint8Array>;
  cancel(): Promise<void>;
}
