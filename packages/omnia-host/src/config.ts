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

/** Load the daemon configuration from the documented OMNIA_* environment. */
export function loadConfigFromEnv(env: NodeJS.ProcessEnv = process.env): OmniaHostConfig {
  const dataRoot = path.join(os.homedir(), '.totem', 'omnia');

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
  };
}
