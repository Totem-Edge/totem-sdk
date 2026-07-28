/**
 * CoAP transport port — injected by the caller.
 *
 * CoAP (RFC 7252) runs over UDP. The caller provides the socket.
 * Messages are confirmable (CON), non-confirmable (NON),
 * acknowledgement (ACK), or reset (RST).
 */

export interface CoapTransportPort {
  /** Bind to a local port. */
  bind(port: number): Promise<void>;
  /** Close the socket. */
  close(): Promise<void>;
  /** Send a CoAP message to a remote endpoint. */
  send(host: string, port: number, message: Uint8Array): Promise<void>;
  /** Register a handler for inbound CoAP messages. */
  onMessage(handler: (message: Uint8Array, remote: { host: string; port: number }) => void): () => void;
  /** Register a handler for socket errors. */
  onError(handler: (err: Error) => void): () => void;
}

export type CoapMessageType = 'CON' | 'NON' | 'ACK' | 'RST';

export type CoapMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface CoapMessage {
  /** Message type. */
  type: CoapMessageType;
  /** Request method (only for CON/NON requests). */
  method?: CoapMethod;
  /** Response code (only for ACK responses). */
  responseCode?: string;
  /** Message ID for deduplication. */
  messageId: number;
  /** Token for request/response matching. */
  token: Uint8Array;
  /** URI path (e.g. ["sensors", "temperature"]). */
  path: string[];
  /** Payload bytes. */
  payload: Uint8Array;
  /** Remote endpoint. */
  remote: { host: string; port: number };
  /** Timestamp of receipt. */
  receivedAt: number;
}
