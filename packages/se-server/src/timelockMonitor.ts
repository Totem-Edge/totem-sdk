import { Pool } from 'pg';
import { getApproachingTimelockChains, StatechainRecord } from './db';

export interface TimelockAlert {
  chain: StatechainRecord;
  message: string;
}

export interface TimelockMonitorOptions {
  intervalMs?: number;
  onAlert?: (alert: TimelockAlert) => void;
}

export function createTimelockMonitor(pool: Pool, opts: TimelockMonitorOptions = {}) {
  const intervalMs = opts.intervalMs ?? 15 * 60 * 1000;
  let timer: NodeJS.Timeout | null = null;
  let consecutiveFailures = 0;

  async function scan(): Promise<void> {
    try {
      consecutiveFailures = 0;
      const chains = await getApproachingTimelockChains(pool);
      for (const chain of chains) {
        const message =
          `[se-server] Statechain ${chain.chain_id} (project: ${chain.project_id}) ` +
          `has been in disputed status since ${chain.updated_at.toISOString()} — ` +
          `owner may reclaim unilaterally after 256-block timelock.`;
        console.warn(message);
        opts.onAlert?.({ chain, message });
      }
    } catch (err: any) {
      consecutiveFailures++;
      console.error(`[se-server] Timelock monitor error (failure #${consecutiveFailures}):`, err?.message ?? err);
    }
  }

  return {
    start() {
      if (timer) return;
      scan();
      timer = setInterval(scan, intervalMs);
      console.log(`[se-server] Timelock monitor running every ${intervalMs / 60_000} minutes`);
    },
    stop() {
      if (timer) { clearInterval(timer); timer = null; }
    },
  };
}
