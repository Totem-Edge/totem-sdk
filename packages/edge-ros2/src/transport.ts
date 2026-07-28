/**
 * ROS 2 transport port — injected by the caller.
 *
 * ROS 2 uses DDS (Data Distribution Service) middleware for discovery,
 * publish/subscribe, and service calls. The caller provides the DDS
 * implementation (eProsima Fast DDS, Cyclone DDS, or rmw layer).
 */

export interface Ros2TransportPort {
  /** Initialise the ROS 2 context. */
  init(args?: string[]): Promise<void>;
  /** Shutdown the ROS 2 context. */
  shutdown(): Promise<void>;
  /** Create a publisher on a typed topic. */
  createPublisher(topic: string, messageType: string): Promise<Ros2Publisher>;
  /** Create a subscription on a typed topic. */
  createSubscription(topic: string, messageType: string, handler: (msg: Ros2Message) => void): Promise<Ros2Subscription>;
  /** Create a service client. */
  createClient(service: string, serviceType: string): Promise<Ros2Client>;
  /** Create a service server. */
  createService(service: string, serviceType: string, handler: (request: Ros2Message) => Promise<Ros2Message>): Promise<Ros2Server>;
  /** Register handler for node errors. */
  onError(handler: (err: Error) => void): () => void;
}

export interface Ros2Publisher {
  publish(message: Ros2Message): Promise<void>;
  destroy(): Promise<void>;
}

export interface Ros2Subscription {
  destroy(): Promise<void>;
}

export interface Ros2Client {
  call(request: Ros2Message, timeoutMs?: number): Promise<Ros2Message>;
  destroy(): Promise<void>;
}

export interface Ros2Server {
  destroy(): Promise<void>;
}

export interface Ros2Message {
  /** Serialised message bytes (CDR or custom serialisation). */
  data: Uint8Array;
  /** Message type name (e.g. "sensor_msgs/msg/Image"). */
  type: string;
  /** Source node name. */
  sourceNode?: string;
  /** ROS timestamp (nanoseconds since epoch). */
  timestamp?: bigint;
  /** Frame ID for TF transforms. */
  frameId?: string;
  /** Timestamp of receipt. */
  receivedAt: number;
}
