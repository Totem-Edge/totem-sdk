import os from 'node:os';
import path from 'node:path';

export interface OmniaHostConfig {
  port: number;
  host: string;
  dbPath: string;
  chainRpcUrl: string;
  chainRpcPassword?: string;
  analyticsDbPath?: string;
  relay?: string;
  localPubkey?: string;
  localPartyId?: string;
  localAddressIndex?: number;
  localSettlementAddress?: string;
  nodeMode?: string;
  wsPath: string;
  /** BIP39 mnemonic or hex seed (same formats @totemsdk/core accepts). */
  seed?: string;
  /** Path to a keyfile JSON (resolved against cwd). */
  keyfile?: string;
  /** Keyfile decryption passphrase. */
  keyfilePassphrase?: string;
  /** Stable device id for the lease journal. */
  deviceId?: string;
  /** "1" forces read-only mode even with keys present. */
  readOnly: boolean;
  /** Identity file containing a delegated identity claim (operator root → service delegate). */
  identityFile?: string;
  /** EdgeServiceManifest serviceType (default "omnia-router"). */
  serviceType: string;
}

function parsePort(value: string | undefined): number {
  if (!value) return 50052;

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`OMNIA_HOST_PORT must be an integer between 1 and 65535; received ${value}`);
  }
  return port;
}

function optional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function optionalInteger(value: string | undefined): number | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`OMNIA_LOCAL_ADDRESS_INDEX must be a non-negative integer; received ${value}`);
  return parsed;
}

function parseSeed(value: string | undefined): string | undefined {
  const seed = optional(value);
  if (!seed) return undefined;
  const words = seed.trim().split(/\s+/);
  const looksLikeMnemonic = words.length >= 12 && words.every((word) => /^[a-zA-Z]+$/.test(word));
  const looksLikeHex = /^(0x)?[0-9a-fA-F]+$/.test(seed.trim());
  if (!looksLikeMnemonic && !looksLikeHex) {
    throw new Error(
      'OMNIA_HOST_SEED must be a BIP39 mnemonic (12+ words) or a hex seed (e.g. 0x…64 hex chars); ' +
      'received a value that is neither',
    );
  }
  if (looksLikeHex) {
    const raw = seed.trim().replace(/^0x/i, '');
    if (raw.length !== 64) {
      throw new Error(
        `OMNIA_HOST_SEED hex form must be exactly 32 bytes (64 hex chars); received ${raw.length} hex chars`,
      );
    }
  }
  return seed;
}

/** Load the daemon configuration from the documented OMNIA_* environment. */
export function loadConfigFromEnv(env: NodeJS.ProcessEnv = process.env): OmniaHostConfig {
  const dataRoot = path.join(os.homedir(), '.totem', 'omnia');

  const seed = parseSeed(env.OMNIA_HOST_SEED);
  const keyfile = optional(env.OMNIA_HOST_KEYFILE);
  if (seed && keyfile) {
    throw new Error(
      'OMNIA_HOST_SEED and OMNIA_HOST_KEYFILE are mutually exclusive — set exactly one of them',
    );
  }

  return {
    port: parsePort(env.OMNIA_HOST_PORT),
    host: env.OMNIA_HOST_BIND?.trim() || '127.0.0.1',
    dbPath: env.OMNIA_HOST_DB?.trim() || path.join(dataRoot, 'omnia.sqlite'),
    chainRpcUrl: env.OMNIA_CHAIN_RPC?.trim() || 'http://127.0.0.1:9005',
    chainRpcPassword: optional(env.OMNIA_CHAIN_RPC_PASSWORD),
    analyticsDbPath: optional(env.OMNIA_ANALYTICS_DB),
    relay: optional(env.OMNIA_RELAY),
    localPubkey: optional(env.OMNIA_LOCAL_PUBKEY),
    localPartyId: optional(env.OMNIA_LOCAL_PARTY_ID),
    localAddressIndex: optionalInteger(env.OMNIA_LOCAL_ADDRESS_INDEX),
    localSettlementAddress: optional(env.OMNIA_LOCAL_SETTLEMENT_ADDRESS),
    nodeMode: optional(env.OMNIA_NODE_MODE),
    wsPath: env.OMNIA_WS_PATH?.trim() || '/rpc',
    seed,
    keyfile,
    keyfilePassphrase: optional(env.OMNIA_HOST_KEYFILE_PASSPHRASE),
    deviceId: optional(env.OMNIA_HOST_DEVICE_ID),
    readOnly: env.OMNIA_HOST_READ_ONLY?.trim() === '1',
    identityFile: optional(env.OMNIA_HOST_IDENTITY_FILE),
    serviceType: optional(env.OMNIA_HOST_SERVICE_TYPE) ?? 'omnia-router',
  };
}
