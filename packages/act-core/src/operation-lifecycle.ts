/**
 * RFC-022 §5.6 — reconcile/cancel/open for asynchronous industrial operations.
 *
 * The host must be able to reconstruct or retain the PreparedDeviceOp for an
 * operation (the durable record is intentionally small). `resolvePrepared`
 * supplies it; a missing operation fails closed.
 */

import type {
  ActionOutcome,
  IndustrialActionDefinition,
  PreparedDeviceOp,
} from './edge-adapter.js';
import {
  isTerminalOperationStatus,
  type DeviceOperationRecord,
  type DeviceOperationStore,
  type OperationStatus,
} from './operation-store.js';

export interface OperationLifecycle {
  reconcile(operationId: string): Promise<DeviceOperationRecord>;
  cancel(operationId: string): Promise<DeviceOperationRecord>;
  open(): Promise<DeviceOperationRecord[]>;
}

export interface IndustrialOperationLifecycleOptions<TResult = unknown> {
  def: IndustrialActionDefinition<TResult>;
  store: DeviceOperationStore;
  /** Fetch the prepared command for a durable record, or undefined if unavailable. */
  resolvePrepared(record: DeviceOperationRecord): Promise<PreparedDeviceOp | undefined>;
  now?: () => number;
}

export function createIndustrialOperationLifecycle<TResult = unknown>(
  options: IndustrialOperationLifecycleOptions<TResult>,
): OperationLifecycle {
  const now = options.now ?? (() => Date.now());

  async function load(operationId: string): Promise<DeviceOperationRecord> {
    const record = await options.store.getOperation(operationId);
    if (!record) throw new Error(`operation ${operationId} not found`);
    return record;
  }

  async function resolve(record: DeviceOperationRecord): Promise<PreparedDeviceOp> {
    const prepared = await options.resolvePrepared(record);
    if (!prepared) throw new Error(`prepared command for operation ${record.operationId} is unavailable`);
    return prepared;
  }

  async function transition(next: DeviceOperationRecord): Promise<DeviceOperationRecord> {
    if (!await options.store.transitionOperation(next)) {
      throw new Error(`operation ${next.operationId} disappeared during transition`);
    }
    return next;
  }

  return {
    async reconcile(operationId) {
      const record = await load(operationId);
      if (isTerminalOperationStatus(record.status)) return record;
      if (record.status === 'in-flight') {
        throw new Error('operation has not been dispatched; reconcile requires an accepted/running record');
      }
      const reconcile = options.def.async?.reconcile;
      if (!reconcile) throw new Error(`action '${options.def.kind}' does not support reconciliation`);
      const prepared = await resolve(record);
      const progress = await reconcile(prepared, record);

      let status: OperationStatus;
      let outcome: ActionOutcome | undefined;
      switch (progress.status) {
        case 'confirmed':
          status = 'confirmed';
          outcome = 'confirmed';
          break;
        case 'failed':
          status = 'failed';
          outcome = 'failed';
          break;
        case 'accepted':
          status = 'accepted';
          outcome = 'accepted';
          break;
        case 'running':
          status = 'running';
          outcome = 'running';
          break;
        case 'unknown':
          // RFC-022: an uncertain outcome is held in reconciling, never silently
          // converted to success or retried under a fresh identity.
          status = 'reconciling';
          outcome = 'unknown';
          break;
        default:
          throw new Error(`unsupported reconciliation status '${String(progress.status)}'`);
      }

      return transition({
        ...record,
        status,
        ...(outcome !== undefined ? { outcome } : {}),
        updatedAt: now(),
        ...(progress.handle !== undefined ? { handle: progress.handle } : {}),
        ...(progress.progress !== undefined ? { progress: progress.progress } : {}),
        ...(progress.result !== undefined ? { result: progress.result } : {}),
        ...(progress.error !== undefined ? { error: progress.error } : {}),
      });
    },

    async cancel(operationId) {
      const record = await load(operationId);
      if (isTerminalOperationStatus(record.status)) return record;
      const cancel = options.def.async?.cancel;
      if (!cancel) throw new Error(`action '${options.def.kind}' does not support cancellation`);
      const prepared = await resolve(record);
      await cancel(prepared, record);
      // A cancellation request is not proof of cancellation.
      return transition({
        ...record,
        cancelRequested: true,
        status: 'reconciling',
        outcome: 'unknown',
        updatedAt: now(),
      });
    },

    async open() {
      if (!options.store.listOpen) throw new Error('operation store does not support listing open operations');
      return options.store.listOpen();
    },
  };
}
