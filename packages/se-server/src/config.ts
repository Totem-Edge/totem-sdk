export interface SeSignEvent {
  chainId: string;
  eventType: string;
  projectId?: string;
}

export interface SeServerConfig {
  /** 32-byte WOTS seed for the SE key. */
  seSeed: Uint8Array;
  /** Postgres connection string, e.g. postgres://user:pass@host/db */
  databaseUrl: string;
  /** Port to listen on when using createSeServer().listen(). Default 4000. */
  port?: number;
  /** On-chain reclaim timelock in blocks. Default 256. */
  reclaimTimelock?: number;
  /** Adds X-Beta headers to all responses. Default true. */
  betaMode?: boolean;
  /**
   * Called after every SE signing event. Lets operators hook in billing,
   * audit logging, or rate limiting without patching this package.
   */
  onSign?: (event: SeSignEvent) => void;
}

/** Load config from standard environment variables. Throws on missing/invalid SE_KEY. */
export function loadConfigFromEnv(): SeServerConfig {
  const raw = process.env.SE_KEY ?? process.env.STATECHAIN_SE_KEY;
  if (!raw || raw.trim().length < 64) {
    throw new Error(
      '[se-server] SE_KEY environment variable is required and must be 64 hex chars (32 bytes). ' +
      'Generate one with: node scripts/generate-se-key.mjs',
    );
  }
  const cleaned = raw.trim().replace(/^0x/i, '');
  const buf = Buffer.from(cleaned, 'hex');
  if (buf.length !== 32) {
    throw new Error('[se-server] SE_KEY must be exactly 32 bytes (64 hex characters)');
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('[se-server] DATABASE_URL environment variable is required');
  }

  return {
    seSeed: new Uint8Array(buf),
    databaseUrl: dbUrl,
    port: process.env.PORT ? parseInt(process.env.PORT, 10) : 4000,
    reclaimTimelock: process.env.SE_RECLAIM_TIMELOCK
      ? parseInt(process.env.SE_RECLAIM_TIMELOCK, 10)
      : 256,
    betaMode: process.env.SE_BETA_MODE !== 'false',
  };
}
