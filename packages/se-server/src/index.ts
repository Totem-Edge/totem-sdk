import http from 'node:http';
import express from 'express';
import { Pool } from 'pg';
import type { SeServerConfig } from './config';
import { migrateStatechainTables } from './db';
import { createSeRouter } from './router';
import { createTimelockMonitor, TimelockMonitorOptions } from './timelockMonitor';

export type { SeServerConfig, SeSignEvent } from './config';
export { loadConfigFromEnv } from './config';
export type { StatechainRecord } from './db';
export type { TimelockAlert } from './timelockMonitor';
export { migrateStatechainTables } from './db';
export {
  insertStatechainRecord,
  getStatechainRecord,
  updateStatechainOwner,
  updateStatechainStatus,
  insertRevocation,
  isRevoked,
  issueNonce,
  consumeNonce,
  logSignEvent,
  getApproachingTimelockChains,
} from './db';
export { createSeRouter } from './router';
export { createTimelockMonitor } from './timelockMonitor';
export {
  getPublicKeyHex,
  getPublicKeyHexAsync,
  seSign,
  wotsVerifyDigestAsync,
  encryptReclaimTx,
  decryptReclaimTx,
} from './seKey';

export interface SeServer {
  app: express.Express;
  pool: Pool;
  listen(port?: number): Promise<http.Server>;
  close(): Promise<void>;
}

/**
 * Create a fully configured SE server.
 *
 * Runs `migrateStatechainTables` on first `listen()` call.
 * The returned `app` can also be mounted into an existing Express app
 * at any path if you prefer not to bind a new port.
 */
export function createSeServer(
  config: SeServerConfig,
  monitorOpts?: TimelockMonitorOptions,
): SeServer {
  const pool = new Pool({ connectionString: config.databaseUrl });
  const app = express();

  app.use(express.json({ limit: '1mb' }));

  const seRouter = createSeRouter(config, pool);
  app.use('/statechain', seRouter);

  const monitor = createTimelockMonitor(pool, monitorOpts ?? {});
  let server: http.Server | null = null;

  return {
    app,
    pool,

    async listen(port?: number): Promise<http.Server> {
      await migrateStatechainTables(pool);
      monitor.start();

      const listenPort = port ?? config.port ?? 4000;
      server = http.createServer(app);

      await new Promise<void>((resolve, reject) => {
        server!.listen(listenPort, '0.0.0.0', resolve);
        server!.once('error', reject);
      });

      const sePublicKey = (await import('./seKey')).getPublicKeyHex(config.seSeed);
      console.log(`[se-server] Listening on port ${listenPort}`);
      console.log(`[se-server] SE public key: ${sePublicKey}`);
      return server;
    },

    async close(): Promise<void> {
      monitor.stop();
      await pool.end();
      await new Promise<void>((resolve, reject) => {
        if (!server) return resolve();
        server.close((err) => err ? reject(err) : resolve());
      });
    },
  };
}
