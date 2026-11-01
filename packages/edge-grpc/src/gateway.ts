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
  /** gRPC server address to dial on start (host:port). */
  address?: string;
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
      try {
        if (config.address && config.client.connect) await config.client.connect(config.address);
      } catch (error) {
        status = 'error';
        throw error;
      }
      status = 'running';
    },

    async stop(): Promise<void> {
      try {
        if (config.client.close) await config.client.close();
      } finally {
        status = 'stopped';
      }
    },

    async call(path, payload, timeoutMs) {
      if (!isValidPath(path)) return { ok: false, error: `Invalid gRPC method path: ${path}` };
      try {
        const response = await config.client.unaryCall(path, payload, timeoutMs);
        return { ok: true, data: { payload: response } };
      } catch (e: any) {
        return { ok: false, error: e.message, code: e.code };
      }
    },

    async openServerStream(path, payload, timeoutMs) {
      if (!isValidPath(path)) return { ok: false, error: `Invalid gRPC method path: ${path}` };
      try {
        const stream = await config.client.serverStream(path, payload, timeoutMs);
        return { ok: true, data: stream };
      } catch (e: any) {
        return { ok: false, error: e.message, code: e.code };
      }
    },

    async openClientStream(path, timeoutMs) {
      if (!isValidPath(path)) return { ok: false, error: `Invalid gRPC method path: ${path}` };
      try {
        const stream = await config.client.clientStream(path, timeoutMs);
        return { ok: true, data: stream };
      } catch (e: any) {
        return { ok: false, error: e.message, code: e.code };
      }
    },

    async openBidiStream(path, timeoutMs) {
      if (!isValidPath(path)) return { ok: false, error: `Invalid gRPC method path: ${path}` };
      try {
        const stream = await config.client.bidiStream(path, timeoutMs);
        return { ok: true, data: stream };
      } catch (e: any) {
        return { ok: false, error: e.message, code: e.code };
      }
    },
  };
}


function isValidPath(path: string): boolean {
  return /^\/[^/]+\/[^/]+$/.test(path);
}
