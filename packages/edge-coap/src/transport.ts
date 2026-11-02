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

export type CoapMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'FETCH';

export interface CoapBlockOption {
  /** Block number. */
  num: number;
  /** More blocks follow. */
  more: boolean;
  /** Size exponent: block size is 2^(sizeExponent + 4), 16..1024 bytes. */
  sizeExponent: number;
}

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
  /** Uri-Host option (3). Defaults to the destination address when absent. */
  uriHost?: string;
  /** Uri-Port option (7). Defaults to the destination port when absent. */
  uriPort?: number;
  /** Uri-Query options (15), in order. */
  uriQuery?: string[];
  /** Payload bytes. */
  payload: Uint8Array;
  /** Content-Format option (12), e.g. 0 text/plain, 60 application/cbor. */
  contentFormat?: number;
  /** Accept option (17). */
  accept?: number;
  /** Observe option (6): 0 register, 1 deregister, otherwise notification sequence. */
  observe?: number;
  /** OSCORE option (9) bytes, passed through without interpretation. */
  oscore?: Uint8Array;
  /** Block1 option (27) for blockwise requests. */
  block1?: CoapBlockOption;
  /** Block2 option (23) for blockwise responses. */
  block2?: CoapBlockOption;
  /** Size2 option (28): total response body size hint. */
  size2?: number;
  /** Size1 option (60): total request body size hint. */
  size1?: number;
  /** Remote endpoint. */
  remote: { host: string; port: number };
  /** Timestamp of receipt. */
  receivedAt: number;
}
