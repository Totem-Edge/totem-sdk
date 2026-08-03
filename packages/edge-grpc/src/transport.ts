/**
 * gRPC transport port — injected by the caller.
 *
 * The GrpcClient interface provides high-level gRPC operations.
 * NativeGrpcTransport implements both IStreamTransport and GrpcClient.
 */

import type { IStreamTransport } from '@totemsdk/stream-transport';

export type GrpcTransportPort = IStreamTransport;

export interface GrpcMessage {
  path: string;
  payload: Uint8Array;
  isResponse: boolean;
  requestId?: string;
  receivedAt: number;
}

export interface GrpcStreamHandle {
  readonly streamId: string;
  send(payload: Uint8Array): Promise<void>;
  close(): Promise<void>;
  onData(handler: (payload: Uint8Array) => void): () => void;
  onEnd(handler: () => void): () => void;
  onError(handler: (err: Error) => void): () => void;
}

export interface GrpcClient {
  unaryCall(path: string, payload: Uint8Array, deadlineMs?: number): Promise<Uint8Array>;
  serverStream(path: string, payload: Uint8Array, deadlineMs?: number): Promise<GrpcStreamHandle>;
  clientStream(path: string, deadlineMs?: number): Promise<GrpcStreamHandle>;
  bidiStream(path: string, deadlineMs?: number): Promise<GrpcStreamHandle>;
}
