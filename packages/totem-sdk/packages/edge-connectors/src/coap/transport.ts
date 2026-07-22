export interface CoapTransportPort {
  bind(port: number): Promise<void>;
  close(): Promise<void>;
  send(host: string, port: number, message: Uint8Array): Promise<void>;
  onMessage(handler: (message: Uint8Array, remote: { host: string; port: number }) => void): () => void;
  onError(handler: (err: Error) => void): () => void;
}

export type CoapMessageType = 'CON' | 'NON' | 'ACK' | 'RST';
export type CoapMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface CoapMessage {
  type: CoapMessageType;
  method?: CoapMethod;
  responseCode?: string;
  messageId: number;
  token: Uint8Array;
  path: string[];
  payload: Uint8Array;
  remote: { host: string; port: number };
  receivedAt: number;
}
