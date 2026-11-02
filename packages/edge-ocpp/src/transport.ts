/**
 * OCPP transport port — injected by the caller.
 *
 * The caller supplies a WebSocket (or test) transport that carries OCPP-J text
 * frames. The connector owns framing, correlation, CALL handling, heartbeats
 * and proof shaping.
 */

export interface OcppTransportPort {
  connect(url: string, protocols?: string[]): Promise<void>;
  close(): Promise<void>;
  send(message: string): Promise<void>;
  onMessage(handler: (message: string) => void): () => void;
  onClose(handler: () => void): () => void;
  onError(handler: (err: Error) => void): () => void;
  readonly state?: 'closed' | 'connecting' | 'open';
}
