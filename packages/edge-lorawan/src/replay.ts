/** LoRaWAN frame/session replay guard, independent of any native database. */
import type { CasStore, StorageAdapterWithCapabilities } from '@totemsdk/storage';

export interface LorawanReplayStore {
  beginSession(devAddr: string, now: number): Promise<number>;
  claimFrame(devAddr: string, frameCounter: number, now: number): Promise<boolean>;
}

interface SessionRecord { epoch: number; maxFrame: number; updatedAt: number }

export function createMemoryLorawanReplayStore(): LorawanReplayStore {
  const sessions = new Map<string, SessionRecord>();
  return {
    async beginSession(devAddr) {
      const epoch = (sessions.get(devAddr)?.epoch ?? 0) + 1;
      sessions.set(devAddr, { epoch, maxFrame: -1, updatedAt: Date.now() });
      return epoch;
    },
    async claimFrame(devAddr, frameCounter) {
      const session = sessions.get(devAddr);
      if (!session || !Number.isSafeInteger(frameCounter) || frameCounter < 0) return false;
      if (frameCounter <= session.maxFrame) return false;
      session.maxFrame = frameCounter;
      return true;
    },
  };
}

export interface StorageLorawanReplayStoreOptions {
  namespace?: string;
  requireDurable?: boolean;
}

/** CAS-backed durable guard over the neutral storage abstraction. */
export function createStorageLorawanReplayStore(
  storage: StorageAdapterWithCapabilities & CasStore,
  options: StorageLorawanReplayStoreOptions = {},
): LorawanReplayStore {
  if (typeof storage.conditionalUpdate !== 'function') throw new Error('LoRaWAN replay storage requires CAS');
  if (options.requireDurable !== false && storage.capabilities.acknowledge !== 'durably-acknowledged') {
    throw new Error('LoRaWAN replay storage must be durably acknowledged');
  }
  const namespace = options.namespace ?? 'totem_lorawan_replay:v1';
  if (!namespace.trim()) throw new Error('LoRaWAN replay namespace must be nonempty');
  const key = (devAddr: string) => `${namespace}:${devAddr}`;
  async function mutate(devAddr: string, now: number, update: (current: SessionRecord | null) => SessionRecord | null) {
    if (!devAddr.trim()) return { changed: false, record: null as SessionRecord | null };
    if (!Number.isSafeInteger(now) || now < 0) throw new Error('LoRaWAN replay timestamp must be a safe nonnegative integer');
    const result = await storage.conditionalUpdate<SessionRecord>(key(devAddr), (current) => {
      const next = update(current ?? null);
      return next ? { next } : { abort: 'replayed-or-stale' };
    });
    return { changed: result.applied, record: (result.value ?? null) as SessionRecord | null };
  }
  return {
    async beginSession(devAddr, now) {
      let epoch = 1;
      const result = await mutate(devAddr, now, (current) => {
        epoch = (current?.epoch ?? 0) + 1;
        return { epoch, maxFrame: -1, updatedAt: now };
      });
      if (!result.changed) throw new Error(`LoRaWAN session reset failed for ${devAddr}`);
      return epoch;
    },
    async claimFrame(devAddr, frameCounter, now) {
      if (!Number.isSafeInteger(frameCounter) || frameCounter < 0) return false;
      const result = await mutate(devAddr, now, (current) => {
        if (!current || frameCounter <= current.maxFrame) return null;
        return { ...current, maxFrame: frameCounter, updatedAt: now };
      });
      return result.changed;
    },
  };
}
