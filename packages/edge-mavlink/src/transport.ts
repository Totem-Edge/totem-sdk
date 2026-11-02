/**
 * MAVLink transport port — injected by the caller.
 *
 * The caller supplies the byte pipe (serial, UDP, TCP, WebSocket or a test
 * simulator). The connector owns MAVLink 1/2 framing, CRC, message decoding,
 * heartbeat, command correlation and proof shaping.
 */

export interface MavlinkTransportPort {
  start(): Promise<void>;
  stop(): Promise<void>;
  send(bytes: Uint8Array): Promise<void>;
  onData(handler: (bytes: Uint8Array) => void): () => void;
  onError(handler: (err: Error) => void): () => void;
}
