import type { EdgeRuntime, EdgeOperationResult } from '@totemsdk/edge';
import type { OpcuaTransportPort, OpcuaNode, OpcuaVariable, OpcuaSubscription } from './transport.js';

export interface OpcuaGatewayConfig {
  runtime: EdgeRuntime;
  transport: OpcuaTransportPort;
  endpointUrl: string;
  subscriptions?: OpcuaSubscriptionBinding[];
}

export interface OpcuaSubscriptionBinding {
  nodeId: string;
  intervalMs: number;
  sensorId?: string;
}

export interface OpcuaGateway {
  start(): Promise<void>;
  stop(): Promise<void>;
  readonly status: 'stopped' | 'running' | 'error';
  browse(nodeId: string): Promise<EdgeOperationResult<{ nodes: OpcuaNode[] }>>;
  readVariable(nodeId: string): Promise<EdgeOperationResult<{ variable: OpcuaVariable }>>;
  writeVariable(nodeId: string, value: unknown, dataType?: string): Promise<EdgeOperationResult>;
}

export function createOpcuaGateway(config: OpcuaGatewayConfig): OpcuaGateway {
  let status: 'stopped' | 'running' | 'error' = 'stopped';
  const subs: OpcuaSubscription[] = [];
  let unsubError: (() => void) | undefined;

  return {
    get status() { return status; },

    async start(): Promise<void> {
      if (status === 'running') return;
      await config.transport.connect(config.endpointUrl);
      unsubError = config.transport.onError(() => { status = 'error'; });

      for (const binding of config.subscriptions ?? []) {
        const sub = await config.transport.subscribe(binding.nodeId, binding.intervalMs);
        sub.onData((variable) => {
          if (binding.sensorId && config.runtime.ports.proof) {
            config.runtime.ports.proof.createProof({
              subject: `sensor:${binding.sensorId}`,
              claims: [{ sensorId: binding.sensorId, nodeId: variable.nodeId, value: variable.value, dataType: variable.dataType, timestamp: Date.now() }],
            }).catch(() => {});
          }
        });
        subs.push(sub);
      }
      status = 'running';
    },

    async stop(): Promise<void> {
      unsubError?.();
      for (const sub of subs) await sub.cancel().catch(() => {});
      subs.length = 0;
      await config.transport.disconnect();
      status = 'stopped';
    },

    async browse(nodeId) {
      try { const nodes = await config.transport.browse(nodeId); return { ok: true, data: { nodes } }; }
      catch (e) { return { ok: false, error: String(e) }; }
    },
    async readVariable(nodeId) {
      try { const variable = await config.transport.readVariable(nodeId); return { ok: true, data: { variable } }; }
      catch (e) { return { ok: false, error: String(e) }; }
    },
    async writeVariable(nodeId, value, dataType) {
      try { await config.transport.writeVariable(nodeId, value, dataType); return { ok: true }; }
      catch (e) { return { ok: false, error: String(e) }; }
    },
  };
}
