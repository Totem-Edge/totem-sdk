export interface IStreamTransport {
  on(event: string, handler: (...args: unknown[]) => void): void;
  send(data: Uint8Array): void;
  close(): void;
}

export type GrpcTransportPort = IStreamTransport;

export interface GrpcMessage {
  path: string;
  payload: Uint8Array;
  isResponse: boolean;
  requestId?: string;
  receivedAt: number;
}
