import os from 'node:os';
import path from 'node:path';
import type { CustodyMode } from '@totemsdk/omnia';

export interface OmniaHostConfig {
  port: number;
  host: string;
  dbPath: string;
  chainRpcUrl: string;
  chainRpcPassword?: string;
  analyticsDbPath?: string;
  /** Durable observation journal DB (default: alongside dbPath). */
  observeDbPath?: string;
  /** Observation network id (multi-network deployments). */
  networkId?: string;
  /** Expected genesis hash; startup fails if the node reports a different chain. */
  genesisHash?: string;
  /** Stable observation source id (default: localPartyId or "omnia-host"). */
  sourceNodeId?: string;
  /** Disable the observation feed entirely (OMNIA_OBSERVE=0). */
  observeDisabled?: boolean;
  relay?: string;
  localPubkey?: string;
  localPartyId?: string;
  localAddressIndex?: number;
  localSettlementAddress?: string;
  /** Address to source funding coins from when the caller omits fundingCoinId. */
  fundingAddress?: string;
  /** Optional release-feed URL. Awareness only: never enforces or installs. */
  updateCheckUrl?: string;
  /** Release-feed poll interval (default 6h). */
  updateCheckIntervalMs?: number;
  /** Installed versions to evaluate, as { "@totemsdk/name": "x.y.z" }. */
  updateCheckPackages?: Record<string, string>;
  nodeMode?: string;
  /**
   * Public key (0x…) that owns the funding coin. When set, the host signs the
   * funding-transaction digest via the node's `sign` command to assemble the
   * channel funding witness (OMNIA_FUNDING_PUBKEY).
   */
  fundingPubkey?: string;
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
  /**
   * Deployment custody mode (RFC-058). Defaults to self-custody; hosted custody
   * is explicit and policy-controlled. This does not change on-chain custody.
   */
  custodyMode?: CustodyMode;
  /** Identity file containing a delegated identity claim (operator root → service delegate). */
  identityFile?: string;
  /** EdgeServiceManifest serviceType (default "omnia-router"). */
  serviceType: string;
  /**
   * Browser Origin allowlist for the control plane (OMNIA_ALLOWED_ORIGINS,
   * comma-separated). Undefined/empty allows any Origin.
   */
  allowedOrigins?: string[];
  /**
   * Bearer token required on control-plane requests (OMNIA_CONTROL_TOKEN).
   * Undefined disables token auth.
   */
  controlToken?: string;
  /** RFC-062 local P2P hub (optional). One Hyperswarm shared by dapps. */
  p2pHubPort?: number;
  /** RFC-062 shared hub URL; when set the host does not start a local hub. */
  p2pHubUrl?: string;
  p2pHubHost?: string;
  p2pHubToken?: string;
  p2pHubOrigins?: string[];
  p2pHubTopics?: string[];
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

function parseOrigins(value: string | undefined): string[] | undefined {
  const parts = value
    ?.split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return parts && parts.length > 0 ? parts : undefined;
}

function parseOptionalPort(value: string | undefined, name: string): number | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const port = Number(trimmed);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} must be an integer between 1 and 65535; received ${value}`);
  }
  return port;
}

function parseWsUrl(value: string | undefined, name: string): string | undefined {
  const url = optional(value);
  if (!url) return undefined;
  if (!/^wss?:\/\//i.test(url)) throw new Error(`${name} must be a ws:// or wss:// URL`);
  return url;
}

function parseList(value: string | undefined): string[] | undefined {
  const parts = value?.split(',').map((part) => part.trim()).filter(Boolean);
  return parts && parts.length > 0 ? parts : undefined;
}

function parseCustodyMode(value: string | undefined): CustodyMode {
  const mode = optional(value) ?? 'self';
  if (mode !== 'self' && mode !== 'trust-minimised' && mode !== 'hosted') {
    throw new Error(`OMNIA_CUSTODY must be self, trust-minimised or hosted; received ${value}`);
  }
  return mode;
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

function parseUpdateCheckPackages(raw: string | undefined): Record<string, string> | undefined {
  if (!raw?.trim()) return undefined;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('must be a JSON object of name -> version');
    }
    const out: Record<string, string> = {};
    for (const [name, version] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof version !== 'string') throw new Error(`version for ${name} must be a string`);
      out[name] = version;
    }
    return out;
  } catch (err) {
    throw new Error(`OMNIA_UPDATE_CHECK_PACKAGES is invalid: ${err instanceof Error ? err.message : String(err)}`);
  }
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

  const dbPath = env.OMNIA_HOST_DB?.trim() || path.join(dataRoot, 'omnia.sqlite');
  return {
    port: parsePort(env.OMNIA_HOST_PORT),
    host: env.OMNIA_HOST_BIND?.trim() || '127.0.0.1',
    dbPath,
    chainRpcUrl: env.OMNIA_CHAIN_RPC?.trim() || 'http://127.0.0.1:9005',
    chainRpcPassword: optional(env.OMNIA_CHAIN_RPC_PASSWORD),
    analyticsDbPath: optional(env.OMNIA_ANALYTICS_DB),
    observeDbPath: optional(env.OMNIA_OBSERVE_DB) ?? path.join(path.dirname(dbPath), 'observe.sqlite'),
    networkId: optional(env.OMNIA_NETWORK_ID),
    genesisHash: optional(env.OMNIA_GENESIS_HASH),
    sourceNodeId: optional(env.OMNIA_SOURCE_NODE_ID),
    observeDisabled: env.OMNIA_OBSERVE?.trim() === '0' || env.OMNIA_OBSERVE?.trim().toLowerCase() === 'false',
    relay: optional(env.OMNIA_RELAY),
    localPubkey: optional(env.OMNIA_LOCAL_PUBKEY),
    localPartyId: optional(env.OMNIA_LOCAL_PARTY_ID),
    localAddressIndex: optionalInteger(env.OMNIA_LOCAL_ADDRESS_INDEX),
    localSettlementAddress: optional(env.OMNIA_LOCAL_SETTLEMENT_ADDRESS),
    fundingAddress: optional(env.OMNIA_FUNDING_ADDRESS),
    updateCheckUrl: optional(env.OMNIA_UPDATE_CHECK_URL),
    updateCheckIntervalMs: env.OMNIA_UPDATE_CHECK_INTERVAL_MS
      ? Number(env.OMNIA_UPDATE_CHECK_INTERVAL_MS)
      : undefined,
    updateCheckPackages: parseUpdateCheckPackages(env.OMNIA_UPDATE_CHECK_PACKAGES),
    nodeMode: optional(env.OMNIA_NODE_MODE),
    fundingPubkey: optional(env.OMNIA_FUNDING_PUBKEY),
    wsPath: env.OMNIA_WS_PATH?.trim() || '/rpc',
    seed,
    keyfile,
    keyfilePassphrase: optional(env.OMNIA_HOST_KEYFILE_PASSPHRASE),
    deviceId: optional(env.OMNIA_HOST_DEVICE_ID),
    readOnly: env.OMNIA_HOST_READ_ONLY?.trim() === '1',
    custodyMode: parseCustodyMode(env.OMNIA_CUSTODY),
    identityFile: optional(env.OMNIA_HOST_IDENTITY_FILE),
    serviceType: optional(env.OMNIA_HOST_SERVICE_TYPE) ?? 'omnia-router',
    allowedOrigins: parseOrigins(env.OMNIA_ALLOWED_ORIGINS),
    p2pHubPort: parseOptionalPort(env.OMNIA_P2P_HUB_PORT, 'OMNIA_P2P_HUB_PORT'),
    p2pHubUrl: parseWsUrl(env.OMNIA_P2P_HUB_URL, 'OMNIA_P2P_HUB_URL'),
    p2pHubHost: optional(env.OMNIA_P2P_HUB_HOST),
    p2pHubToken: optional(env.OMNIA_P2P_HUB_TOKEN),
    p2pHubOrigins: parseOrigins(env.OMNIA_P2P_HUB_ORIGINS),
    p2pHubTopics: parseList(env.OMNIA_P2P_HUB_TOPICS),
    controlToken: optional(env.OMNIA_CONTROL_TOKEN),
  };
}
