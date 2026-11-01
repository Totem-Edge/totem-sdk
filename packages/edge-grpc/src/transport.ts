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

export interface GrpcTlsConfig {
  /** PEM-encoded CA bundle. Defaults to the system roots. */
  caCert?: string;
  /** PEM-encoded client certificate for mutual TLS. */
  cert?: string;
  /** PEM-encoded client private key. */
  key?: string;
  /** TLS server name (SNI) when the dial address is an IP. */
  serverName?: string;
  /** Disable certificate verification (test/profile use only). */
  insecureSkipVerify?: boolean;
}

export interface GrpcClient {
  /** Dial the gRPC server; optional for already-connected clients. */
  connect?(address: string): Promise<void>;
  /** Close the connection and cancel streams. */
  close?(): Promise<void>;
  unaryCall(path: string, payload: Uint8Array, deadlineMs?: number): Promise<Uint8Array>;
  serverStream(path: string, payload: Uint8Array, deadlineMs?: number): Promise<GrpcStreamHandle>;
  clientStream(path: string, deadlineMs?: number): Promise<GrpcStreamHandle>;
  bidiStream(path: string, deadlineMs?: number): Promise<GrpcStreamHandle>;
}
