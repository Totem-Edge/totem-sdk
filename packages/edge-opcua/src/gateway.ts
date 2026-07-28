/**
 * OPC-UA Edge Gateway — wires an OpcuaTransportPort into an EdgeRuntime.
 */

import type { EdgeRuntime, EdgeOperationResult } from '@totemsdk/edge';
import type { OpcuaTransportPort, OpcuaNode, OpcuaValue, OpcuaSubscription } from './transport.js';

export interface OpcuaGatewayConfig {
  runtime: EdgeRuntime;
  transport: OpcuaTransportPort;
  endpointUrl: string;
  /** Nodes to subscribe to on start. */
  subscriptions?: OpcuaNodeBinding[];
}

export interface OpcuaNodeBinding {
  nodeId: string;
  sensorId?: string;
  samplingInterval: number;
}

export interface OpcuaGateway {
  start(): Promise<void>;
  stop(): Promise<void>;
  readonly status: 'stopped' | 'running' | 'error';
  browse(nodeId: string): Promise<EdgeOperationResult<{ nodes: OpcuaNode[] }>>;
  read(nodeId: string): Promise<EdgeOperationResult<{ value: OpcuaValue }>>;
  write(nodeId: string, value: OpcuaValue): Promise<EdgeOperationResult>;
  call(objectId: string, methodId: string, args: OpcuaValue[]): Promise<EdgeOperationResult<{ results: OpcuaValue[] }>>;
}

export function createOpcuaGateway(config: OpcuaGatewayConfig): OpcuaGateway {
  let status: 'stopped' | 'running' | 'error' = 'stopped';
  let sub: OpcuaSubscription | undefined;
  let unsubError: (() => void) | undefined;

  return {
    get status() { return status; },

    async start(): Promise<void> {
      if (status === 'running') return;
      await config.transport.connect(config.endpointUrl);
      unsubError = config.transport.onError(() => { status = 'error'; });

      const subNodes = (config.subscriptions ?? []).map(s => s.nodeId);
      if (subNodes.length > 0) {
        const interval = config.subscriptions?.[0]?.samplingInterval ?? 1000;
        sub = await config.transport.subscribe(subNodes, interval);
        sub.onChange((events) => {
          for (const event of events) {
            const binding = config.subscriptions?.find(s => s.nodeId === event.nodeId);
            if (binding?.sensorId && config.runtime.ports.proof) {
              config.runtime.ports.proof.createProof({
                subject: `sensor:${binding.sensorId}`,
                claims: [{ sensorId: binding.sensorId, nodeId: event.nodeId, value: event.value.value, dataType: event.value.dataType, sourceTimestamp: event.value.sourceTimestamp, timestamp: event.receivedAt }],
              }).catch(() => {});
            }
          }
        });
      }
      status = 'running';
    },

    async stop(): Promise<void> {
      unsubError?.();
      await sub?.destroy().catch(() => {});
      await config.transport.disconnect();
      status = 'stopped';
    },

    async browse(nodeId) {
      try { const nodes = await config.transport.browse(nodeId); return { ok: true, data: { nodes } }; }
      catch (e) { return { ok: false, error: String(e) }; }
    },
    async read(nodeId) {
      try { const value = await config.transport.read(nodeId); return { ok: true, data: { value } }; }
      catch (e) { return { ok: false, error: String(e) }; }
    },
    async write(nodeId, value) {
      try { await config.transport.write(nodeId, value); return { ok: true }; }
      catch (e) { return { ok: false, error: String(e) }; }
    },
    async call(objectId, methodId, args) {
      try { const results = await config.transport.call(objectId, methodId, args); return { ok: true, data: { results } }; }
      catch (e) { return { ok: false, error: String(e) }; }
    },
  };
}
