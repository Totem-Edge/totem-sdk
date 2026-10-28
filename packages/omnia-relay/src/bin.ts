#!/usr/bin/env node
/**
 * Self-hosted Omnia relay daemon.
 *
 * Environment:
 *   OMNIA_RELAY_HOST  bind address (default 127.0.0.1)
 *   OMNIA_RELAY_PORT  TCP port (default 9300)
 *   OMNIA_RELAY_TOKEN optional bearer token (clients use ?token=...)
 *   OMNIA_RELAY_TLS_KEY / OMNIA_RELAY_TLS_CERT optional PEM paths
 */
import { readFileSync } from 'node:fs';
import { createRelayServer } from './server.js';

async function main(): Promise<void> {
  const port = Number(process.env.OMNIA_RELAY_PORT ?? 9300);
  const host = process.env.OMNIA_RELAY_HOST ?? '127.0.0.1';
  const token = process.env.OMNIA_RELAY_TOKEN;
  const keyPath = process.env.OMNIA_RELAY_TLS_KEY;
  const certPath = process.env.OMNIA_RELAY_TLS_CERT;
  if ((keyPath && !certPath) || (!keyPath && certPath)) {
    throw new Error('OMNIA_RELAY_TLS_KEY and OMNIA_RELAY_TLS_CERT must be supplied together');
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`OMNIA_RELAY_PORT must be 1-65535; received ${process.env.OMNIA_RELAY_PORT}`);
  }
  const server = createRelayServer({
    host,
    port,
    ...(token ? { token } : {}),
    ...(keyPath && certPath
      ? { tls: { key: readFileSync(keyPath), cert: readFileSync(certPath) } }
      : {}),
  });
  const address = await server.start();
  console.log(`[omnia-relay] listening on ${address.url} (clients: ${server.clientCount})`);
  const shutdown = async (): Promise<void> => {
    await server.close();
    process.exit(0);
  };
  process.once('SIGINT', () => { void shutdown(); });
  process.once('SIGTERM', () => { void shutdown(); });
}

main().catch((error) => {
  console.error('[omnia-relay] fatal:', error);
  process.exitCode = 1;
});
