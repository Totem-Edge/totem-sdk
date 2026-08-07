import type { EdgeOmniaPort, EdgeOperationResult } from '@totemsdk/edge';

export interface OmniaHostPortConfig {
  endpoint: string;
  fetch?: typeof globalThis.fetch;
  headers?: Record<string, string>;
}

type RpcResponse = {
  result?: unknown;
  error?: { code?: number; message?: string };
};

function methodName(operation: string): string {
  return `totem_omnia${operation[0].toUpperCase()}${operation.slice(1)}`;
}

export function createOmniaHostPort(config: OmniaHostPortConfig): EdgeOmniaPort {
  const request = config.fetch ?? globalThis.fetch;
  const endpoint = config.endpoint.replace(/\/$/, '');

  async function call<T>(operation: string, params: Record<string, unknown> = {}): Promise<EdgeOperationResult<T>> {
    try {
      const response = await request(`${endpoint}/rpc`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...config.headers },
        body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: methodName(operation), params }),
      });
      const body = await response.json() as RpcResponse;
      if (!response.ok || body.error) {
        return {
          ok: false,
          error: body.error?.message ?? `Omnia host returned HTTP ${response.status}`,
          errorCode: body.error?.code ? String(body.error.code) : 'OMNIA_HOST_ERROR',
        };
      }
      return { ok: true, data: body.result as T };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error), errorCode: 'OMNIA_HOST_UNAVAILABLE' };
    }
  }

  return {
    getChannels: (params) => call('getChannels', params),
    openChannel: (params) => call('openChannel', params),
    pay: (params) => call('pay', params),
    settle: (params) => call('settle', params),
    closeChannel: (params) => call('closeChannel', params),
    getRoute: (params) => call('getRoute', params),
    payMultiHop: (params) => call('payMultiHop', params),
    getSwapRate: (params) => call('getSwapRate', params),
    createFactory: (params) => call('createFactory', params),
    openVirtualChannel: (params) => call('openVirtualChannel', params),
    closeFactory: (params) => call('closeFactory', params),
    spliceIn: (params) => call('spliceIn', params),
    spliceOut: (params) => call('spliceOut', params),
  };
}
