/**
 * Replay claims over the neutral storage abstraction.
 *
 * The connector ships no SQLite/native import. Callers inject any adapter that
 * provides durable, atomic CAS; SQLite/FileStore/etc. remain host choices.
 */
import type { CasStore, StorageAdapterWithCapabilities } from '@totemsdk/storage';
import type { ReplayLedgerStore } from './types.js';

export interface StorageMqttReplayStoreOptions {
  namespace?: string;
  /** Require durable acknowledged writes (default true). */
  requireDurable?: boolean;
}

interface ClaimRecord {
  claimedAt: number;
  expiresAt: number;
}

export function createStorageMqttReplayStore(
  storage: StorageAdapterWithCapabilities & CasStore,
  options: StorageMqttReplayStoreOptions = {},
): ReplayLedgerStore {
  if (typeof storage.conditionalUpdate !== 'function') {
    throw new Error('MQTT replay storage must provide atomic conditionalUpdate/CAS');
  }
  if (options.requireDurable !== false && storage.capabilities.acknowledge !== 'durably-acknowledged') {
    throw new Error('MQTT replay storage must be durably acknowledged');
  }
  const namespace = options.namespace ?? 'totem_mqtt_replay:v3';
  if (!namespace.trim()) throw new Error('MQTT replay namespace must be nonempty');
  return {
    async claim(key, expiresAt, now) {
      if (typeof key !== 'string' || !key) throw new Error('MQTT replay key must be nonempty');
      if (!Number.isSafeInteger(now) || now < 0 || !Number.isSafeInteger(expiresAt) || expiresAt < now) {
        throw new Error('MQTT replay timestamps must be safe integers with expiresAt >= now >= 0');
      }
      // Contention is expected across processes. Retry only the atomic claim;
      // an exhausted retry throws and the command handler fails closed.
      for (let attempt = 0; ; attempt++) {
        try {
          const result = await storage.conditionalUpdate<ClaimRecord>(`${namespace}:${key}`, (current) => {
            if (current && current.expiresAt >= now) return { abort: 'duplicate' };
            return { next: { claimedAt: now, expiresAt } };
          });
          return result.applied;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (attempt >= 20 || !/locked|busy|write-failed|conflict/i.test(message)) throw error;
          await new Promise((resolve) => setTimeout(resolve, 10 + Math.floor(Math.random() * 40)));
        }
      }
    },
  };
}
