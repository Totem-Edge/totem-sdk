/**
 * Demo: Lease Lifecycle Management
 * 
 * Shows how to use LeaseStore, WatermarkStore, and LeaseMonitor from @totemsdk/core
 * for WOTS key management.
 */

import {
  LeaseStore,
  WatermarkStore,
  LeaseMonitor,
  type StoredLease,
} from '@totemsdk/core';
import { createNodeAdapters } from './adapters';
import * as crypto from 'crypto';

function createCoreStorageAdapter(localAdapter: ReturnType<typeof createNodeAdapters>['storage']) {
  return {
    async get<T>(key: string): Promise<T | null> {
      const raw = await localAdapter.get(key);
      if (raw === null) return null;
      try { return JSON.parse(raw) as T; } catch { return raw as unknown as T; }
    },
    async set<T>(key: string, value: T): Promise<void> {
      await localAdapter.set(key, JSON.stringify(value));
    },
    async remove(key: string): Promise<boolean> {
      try { await localAdapter.remove(key); return true; } catch { return false; }
    },
    async clear(): Promise<void> {
      await localAdapter.clear();
    },
    async keys(): Promise<string[]> {
      return [];
    },
    async has(key: string): Promise<boolean> {
      return (await this.get(key)) !== null;
    },
  };
}

function createCoreLoggerAdapter(localLogger: ReturnType<typeof createNodeAdapters>['logger']) {
  return {
    debug(msg: string, ...args: unknown[]) { localLogger.debug(msg); },
    info(msg: string, ...args: unknown[]) { localLogger.info(msg); },
    warn(msg: string, ...args: unknown[]) { localLogger.warn(msg); },
    error(msg: string, ...args: unknown[]) { localLogger.error(msg, args[0] instanceof Error ? args[0] : undefined); },
  };
}

async function main() {
  console.log('='.repeat(60));
  console.log('Demo: Lease Lifecycle Management');
  console.log('='.repeat(60));
  console.log();

  const adapters = createNodeAdapters({
    storagePath: './wallet-data-demo',
    logPrefix: 'Demo',
  });

  const coreStorage = createCoreStorageAdapter(adapters.storage);
  const coreLogger = createCoreLoggerAdapter(adapters.logger);

  const leaseStore = new LeaseStore(coreStorage, coreLogger);
  const watermarkStore = new WatermarkStore(coreStorage, coreLogger);

  await leaseStore.initialize();
  await watermarkStore.initialize();

  await leaseStore.clear();
  await watermarkStore.clear();
  await watermarkStore.initialize();

  console.log('1. Creating a new lease with short expiry (10 seconds)...');
  
  const publicKey = crypto.randomBytes(32).toString('hex');
  
  const lease: StoredLease = {
    leaseId: `lease-${Date.now()}`,
    leaseToken: `token-${Date.now()}`,
    indices: { addressIndex: 0, l1: 0, l2: 0 },
    expiresAt: Date.now() + 10000,
    status: 'active',
    createdAt: Date.now(),
    leaseTTL: 10000,
  };

  await leaseStore.save(lease);
  console.log(`   Lease created: ${lease.leaseId}`);
  console.log(`   Expires at: ${new Date(lease.expiresAt).toISOString()}`);

  console.log();
  console.log('2. Simulating key usage with watermark tracking...');
  
  for (let i = 0; i < 5; i++) {
    const nextIndices = watermarkStore.getNextIndices();
    if (!nextIndices) {
      console.log('   No available indices!');
      break;
    }
    console.log(`   Signed with indices (addressIndex=${nextIndices.addressIndex}, l1=${nextIndices.l1}, l2=${nextIndices.l2})`);
    await watermarkStore.markUsed(nextIndices);
    await watermarkStore.advanceWatermark(nextIndices);
    await new Promise(r => setTimeout(r, 500));
  }

  const stats = watermarkStore.getUsageStats();
  console.log(`   Usage stats: ${stats.used} / ${stats.total} indices used (${stats.percentage.toFixed(4)}%)`);

  console.log();
  console.log('3. Starting lease monitor...');
  
  const monitor = new LeaseMonitor(leaseStore, adapters.timer, coreLogger, {
    defaultIntervalMs: 1000,
    expiryThresholdMs: 5000,
  });
  
  monitor.onExpirySoon((event) => {
    console.log(`   [WARNING] Lease ${event.leaseId} expiring in ${Math.round(event.remainingMs / 1000)}s`);
  });

  monitor.start();

  console.log('4. Waiting for lease to expire (10 seconds)...');
  console.log();

  await new Promise<void>((resolve) => {
    let checkCount = 0;
    const interval = setInterval(async () => {
      checkCount++;
      const activeLeases = leaseStore.getActive();
      
      if (activeLeases.length === 0) {
        console.log();
        console.log('5. Lease expired! Cleaning up...');
        clearInterval(interval);
        monitor.stop();
        resolve();
      } else if (checkCount > 15) {
        clearInterval(interval);
        monitor.stop();
        resolve();
      } else {
        const remaining = Math.round((activeLeases[0].expiresAt - Date.now()) / 1000);
        if (remaining > 0) {
          process.stdout.write(`   Time remaining: ${remaining}s\r`);
        }
      }
    }, 1000);
  });

  console.log();
  console.log('6. Final state:');
  const allLeases = leaseStore.getAll();
  for (const l of allLeases) {
    console.log(`   - ${l.leaseId}: ${l.status}`);
  }

  const finalStats = watermarkStore.getUsageStats();
  console.log(`   Watermark usage: ${finalStats.used}/${finalStats.total}`);

  console.log();
  console.log('='.repeat(60));
  console.log('Demo complete!');
  console.log('='.repeat(60));
}

main().catch(console.error);
