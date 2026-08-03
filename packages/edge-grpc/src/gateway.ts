/**
 * gRPC Edge Gateway — wires a GrpcClient into an EdgeRuntime.
 *
 * The Go native binary handles real gRPC (HTTP/2, protobuf, streaming).
 * The TypeScript gateway provides a high-level API for unary calls and
 * streaming, with proper gRPC status code propagation.
 */

import type { EdgeRuntime, EdgeOperationResult } from '@totemsdk/edge';
import type { GrpcClient, GrpcStreamHandle } from './transport.js';

export interface GrpcGatewayConfig {
  runtime: EdgeRuntime;
  client: GrpcClient;
}

export interface GrpcGateway {
  start(): Promise<void>;
  stop(): Promise<void>;
  readonly status: 'stopped' | 'running' | 'error';
  call(path: string, payload: Uint8Array, timeoutMs?: number): Promise<EdgeOperationResult<{ payload: Uint8Array }>>;
  openServerStream(path: string, payload: Uint8Array, timeoutMs?: number): Promise<EdgeOperationResult<GrpcStreamHandle>>;
  openClientStream(path: string, timeoutMs?: number): Promise<EdgeOperationResult<GrpcStreamHandle>>;
  openBidiStream(path: string, timeoutMs?: number): Promise<EdgeOperationResult<GrpcStreamHandle>>;
}

export function createGrpcGateway(config: GrpcGatewayConfig): GrpcGateway {
  let status: 'stopped' | 'running' | 'error' = 'stopped';

  return {
    get status() { return status; },

    async start(): Promise<void> {
      if (status === 'running') return;
      status = 'running';
    },

    async stop(): Promise<void> {
      status = 'stopped';
    },

    async call(path, payload, timeoutMs) {
      try {
        const response = await config.client.unaryCall(path, payload, timeoutMs);
        return { ok: true, data: { payload: response } };
      } catch (e: any) {
        return { ok: false, error: e.message, code: e.code };
      }
    },

    async openServerStream(path, payload, timeoutMs) {
      try {
        const stream = await config.client.serverStream(path, payload, timeoutMs);
        return { ok: true, data: stream };
      } catch (e: any) {
        return { ok: false, error: e.message, code: e.code };
      }
    },

    async openClientStream(path, timeoutMs) {
      try {
        const stream = await config.client.clientStream(path, timeoutMs);
        return { ok: true, data: stream };
      } catch (e: any) {
        return { ok: false, error: e.message, code: e.code };
      }
    },

    async openBidiStream(path, timeoutMs) {
      try {
        const stream = await config.client.bidiStream(path, timeoutMs);
        return { ok: true, data: stream };
      } catch (e: any) {
        return { ok: false, error: e.message, code: e.code };
      }
    },
  };
}
