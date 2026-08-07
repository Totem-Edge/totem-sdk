import { createOmniaHost, loadConfigFromEnv } from './index.js';

async function main(): Promise<void> {
  const host = createOmniaHost(loadConfigFromEnv());
  let closing = false;
  let resolveStopped!: () => void;
  const stopped = new Promise<void>((resolve) => {
    resolveStopped = resolve;
  });

  const shutdown = async (signal: string): Promise<void> => {
    if (closing) return;
    closing = true;
    console.log(`[omnia-host] Received ${signal}; shutting down`);
    try {
      await host.close();
    } finally {
      resolveStopped();
    }
  };

  process.once('SIGINT', () => { void shutdown('SIGINT'); });
  process.once('SIGTERM', () => { void shutdown('SIGTERM'); });

  await host.start();
  console.log(`[omnia-host] Starting on port ${host.config.port}`);
  await stopped;
}

main().catch((err: unknown) => {
  console.error('[omnia-host] Fatal startup error:', err);
  process.exitCode = 1;
});
