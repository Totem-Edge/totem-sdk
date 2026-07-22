import type { EdgeRuntime, EdgeOperationResult } from '@totemsdk/edge';
import type { MatterTransportPort, MatterNode, MatterAttributeValue, MatterSubscription } from './transport.js';

export interface MatterGatewayConfig {
  runtime: EdgeRuntime;
  transport: MatterTransportPort;
  vendorId: number;
  productId: number;
  subscriptions?: MatterAttributeBinding[];
}

export interface MatterAttributeBinding {
  nodeId: string;
  endpointId: number;
  clusterId: number;
  attributeIds: number[];
  sensorId?: string;
  minInterval: number;
  maxInterval: number;
}

export interface MatterGateway {
  start(): Promise<void>;
  stop(): Promise<void>;
  readonly status: 'stopped' | 'running' | 'error';
  commission(discriminator: number, setupCode: string): Promise<EdgeOperationResult<{ node: MatterNode }>>;
  readAttribute(nodeId: string, endpointId: number, clusterId: number, attributeId: number): Promise<EdgeOperationResult<{ value: MatterAttributeValue }>>;
  writeAttribute(nodeId: string, endpointId: number, clusterId: number, attributeId: number, value: unknown): Promise<EdgeOperationResult>;
  invokeCommand(nodeId: string, endpointId: number, clusterId: number, commandId: number, args: unknown): Promise<EdgeOperationResult<{ result: unknown }>>;
}

export function createMatterGateway(config: MatterGatewayConfig): MatterGateway {
  let status: 'stopped' | 'running' | 'error' = 'stopped';
  const attrSubs: MatterSubscription[] = [];
  let unsubCommissioned: (() => void) | undefined;
  let unsubError: (() => void) | undefined;

  return {
    get status() { return status; },

    async start(): Promise<void> {
      if (status === 'running') return;
      await config.transport.init(config.vendorId, config.productId);
      unsubCommissioned = config.transport.onCommissioned((node) => {
        if (config.runtime.ports.proof) {
          config.runtime.ports.proof.createProof({
            subject: `matter:commissioned`,
            claims: [{ nodeId: node.nodeId, vendorId: node.vendorId, productId: node.productId, timestamp: Date.now() }],
          }).catch(() => {});
        }
      });
      unsubError = config.transport.onError(() => { status = 'error'; });

      for (const binding of config.subscriptions ?? []) {
        for (const attrId of binding.attributeIds) {
          const sub = await config.transport.subscribeAttribute(binding.nodeId, binding.endpointId, binding.clusterId, attrId, binding.minInterval, binding.maxInterval);
          sub.onReport((value) => {
            if (binding.sensorId && config.runtime.ports.proof) {
              config.runtime.ports.proof.createProof({
                subject: `sensor:${binding.sensorId}`,
                claims: [{ sensorId: binding.sensorId, clusterId: value.clusterId, attributeId: value.attributeId, value: value.value, timestamp: value.timestamp }],
              }).catch(() => {});
            }
          });
          attrSubs.push(sub);
        }
      }
      status = 'running';
    },

    async stop(): Promise<void> {
      unsubCommissioned?.(); unsubError?.();
      for (const sub of attrSubs) await sub.cancel().catch(() => {});
      attrSubs.length = 0;
      await config.transport.shutdown();
      status = 'stopped';
    },

    async commission(discriminator, setupCode) {
      try { const node = await config.transport.commission(discriminator, setupCode); return { ok: true, data: { node } }; }
      catch (e) { return { ok: false, error: String(e) }; }
    },
    async readAttribute(nodeId, endpointId, clusterId, attributeId) {
      try { const value = await config.transport.readAttribute(nodeId, endpointId, clusterId, attributeId); return { ok: true, data: { value } }; }
      catch (e) { return { ok: false, error: String(e) }; }
    },
    async writeAttribute(nodeId, endpointId, clusterId, attributeId, value) {
      try { await config.transport.writeAttribute(nodeId, endpointId, clusterId, attributeId, value); return { ok: true }; }
      catch (e) { return { ok: false, error: String(e) }; }
    },
    async invokeCommand(nodeId, endpointId, clusterId, commandId, args) {
      try { const result = await config.transport.invokeCommand(nodeId, endpointId, clusterId, commandId, args); return { ok: true, data: { result } }; }
      catch (e) { return { ok: false, error: String(e) }; }
    },
  };
}
